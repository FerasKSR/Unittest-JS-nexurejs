/**
 * Multipart Form Parser
 *
 * A streaming, memory-efficient parser for multipart/form-data
 * using buffer pooling to minimize allocations.
 */

import { Writable } from 'node:stream';
import { createWriteStream, unlinkSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import os from 'node:os';
import { randomBytes } from 'node:crypto';
import { IncomingMessage } from 'node:http';
import { globalPool } from './buffer-pool';
import { createOptimizedTransform, OptimizedTransform } from './stream-optimizer';
import { extractBoundary } from './http-utils';

// States for the parser
enum ParserState {
  PENDING_BOUNDARY = 0,
  PENDING_HEADERS = 1,
  PENDING_DATA = 2,
  BOUNDARY_REACHED = 3,
  COMPLETE = 4
}

// Parser context type to hold state
interface ParserContext {
  state: ParserState;
  config: Required<MultipartParserOptions>;
  boundaryBuffer: Buffer;
  endBoundaryBuffer: Buffer;
  currentHeaders: Record<string, string>;
  currentName: string;
  currentFilename: string;
  currentPart: Buffer | null;
  currentFieldSize: number;
  headerBuffer: string;
  currentFileStream: Writable | null;
  currentFileSize: number;
  tempFilePath: string;
  fields: MultipartFields;
  files: MultipartFiles;
  fieldCount: number;
  buffer: Buffer | null;
  bufferOffset: number;
}

export interface MultipartFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  path: string;
  size: number;
  truncated: boolean;
}

export interface MultipartFields {
  [key: string]: string;
}

export interface MultipartFiles {
  [key: string]: MultipartFile | MultipartFile[];
}

export interface MultipartResult {
  fields: MultipartFields;
  files: MultipartFiles;
}

export interface MultipartParserOptions {
  maxFileSize?: number;
  maxFields?: number;
  maxFieldSize?: number;
  uploadDir?: string;
  keepFiles?: boolean;
  useBufferPool?: boolean;
  boundary?: string;
}

// Default options
const DEFAULT_OPTIONS: Required<MultipartParserOptions> = {
  maxFileSize: 1024 * 1024 * 50, // 50MB
  maxFields: 100,
  maxFieldSize: 1024 * 1024, // 1MB
  uploadDir: os.tmpdir(),
  keepFiles: false,
  useBufferPool: true,
  boundary: ''
};

// Helper functions
/**
 * Process a chunk of data
 */
function processChunk(ctx: ParserContext, chunk: Buffer): void {
  // If this is the first chunk, handle special case
  if (ctx.state === ParserState.PENDING_BOUNDARY && !ctx.buffer) {
    // First chunk may start with the boundary without the leading CRLF
    const firstBoundary = `--${ctx.config.boundary}`;
    const firstBoundaryBuffer = Buffer.from(firstBoundary);

    // Check if the chunk starts with the boundary
    if (
      chunk.length >= firstBoundaryBuffer.length &&
      chunk.subarray(0, firstBoundaryBuffer.length).equals(firstBoundaryBuffer)
    ) {
      // This is the first boundary, start processing headers from after it
      ctx.buffer = chunk.subarray(firstBoundaryBuffer.length);
      ctx.bufferOffset = 0;
      ctx.state = ParserState.PENDING_HEADERS;
      return;
    }
  }

  // Append chunk to existing buffer or create a new one
  if (ctx.buffer) {
    const newBuffer = globalPool.acquire(ctx.buffer.length - ctx.bufferOffset + chunk.length);
    ctx.buffer.copy(newBuffer, 0, ctx.bufferOffset);
    chunk.copy(newBuffer, ctx.buffer.length - ctx.bufferOffset);

    // Release the old buffer back to the pool
    globalPool.release(ctx.buffer);

    ctx.buffer = newBuffer;
    ctx.bufferOffset = 0;
  } else {
    ctx.buffer = chunk;
    ctx.bufferOffset = 0;
  }

  // Process the buffer based on current state
  processBuffer(ctx);
}

/**
 * Process the current buffer
 */
function processBuffer(ctx: ParserContext): void {
  while (ctx.buffer && ctx.bufferOffset < ctx.buffer.length) {
    switch (ctx.state) {
      case ParserState.PENDING_BOUNDARY:
        processPendingBoundary(ctx);
        break;

      case ParserState.PENDING_HEADERS:
        processPendingHeaders(ctx);
        break;

      case ParserState.PENDING_DATA:
        processPendingData(ctx);
        break;

      case ParserState.BOUNDARY_REACHED:
        // Clean up the current part if any
        finishCurrentPart(ctx);

        // Move past the boundary
        ctx.bufferOffset += 2; // Skip CRLF after boundary
        ctx.state = ParserState.PENDING_HEADERS;
        break;

      case ParserState.COMPLETE:
        // We're done parsing
        return;
    }

    // If we've consumed the entire buffer, release it back to the pool
    if (ctx.bufferOffset >= ctx.buffer.length) {
      globalPool.release(ctx.buffer);
      ctx.buffer = null;
      ctx.bufferOffset = 0;
    }
  }
}

/**
 * Process buffer when expecting a boundary
 */
function processPendingBoundary(ctx: ParserContext): void {
  if (!ctx.buffer) return;

  // Look for the boundary in the buffer
  const boundaryIndex = findBoundary(ctx.buffer, ctx.bufferOffset, ctx.boundaryBuffer);

  if (boundaryIndex >= 0) {
    ctx.bufferOffset = boundaryIndex + ctx.boundaryBuffer.length;
    ctx.state = ParserState.PENDING_HEADERS;
  } else {
    // Boundary not found yet, move past the buffer
    ctx.bufferOffset = ctx.buffer.length;
  }
}

/**
 * Process buffer when expecting headers
 */
function processPendingHeaders(ctx: ParserContext): void {
  if (!ctx.buffer) return;

  // Find end of headers (double CRLF)
  const index = ctx.buffer.indexOf('\r\n\r\n', ctx.bufferOffset, 'utf8');

  if (index >= 0) {
    // Extract headers text
    const headersText = ctx.buffer.subarray(ctx.bufferOffset, index).toString();
    ctx.bufferOffset = index + 4; // Move past double CRLF

    // Parse headers
    parseHeaders(ctx, headersText);

    // Set up for receiving data
    setupPartReceiver(ctx);

    ctx.state = ParserState.PENDING_DATA;
  } else {
    // Headers not yet complete
    ctx.headerBuffer += ctx.buffer.subarray(ctx.bufferOffset).toString();
    ctx.bufferOffset = ctx.buffer.length;

    // Check if headers are too long
    if (ctx.headerBuffer.length > 16 * 1024) {
      throw new Error('Headers too large');
    }
  }
}

/**
 * Process buffer when expecting part data
 */
function processPendingData(ctx: ParserContext): void {
  if (!ctx.buffer) return;

  // Look for the next boundary
  const boundaryIndex = findBoundary(ctx.buffer, ctx.bufferOffset, ctx.boundaryBuffer);
  const endBoundaryIndex = findEndBoundary(ctx.buffer, ctx.bufferOffset, ctx.endBoundaryBuffer);

  if (endBoundaryIndex >= 0) {
    // Found end boundary - parse data up to it
    const dataChunk = ctx.buffer.subarray(ctx.bufferOffset, endBoundaryIndex);
    processPartData(ctx, dataChunk);

    // Finish the current part
    finishCurrentPart(ctx);

    // Move past the end boundary
    ctx.bufferOffset = endBoundaryIndex + ctx.endBoundaryBuffer.length;
    ctx.state = ParserState.COMPLETE;
  } else if (boundaryIndex >= 0) {
    // Found normal boundary - parse data up to it
    const dataChunk = ctx.buffer.subarray(ctx.bufferOffset, boundaryIndex);
    processPartData(ctx, dataChunk);

    // Move to boundary handling state
    ctx.bufferOffset = boundaryIndex + ctx.boundaryBuffer.length;
    ctx.state = ParserState.BOUNDARY_REACHED;
  } else {
    // No boundary found - process all but the last possible boundary match
    const safeLength = ctx.buffer.length - ctx.boundaryBuffer.length - 1;

    if (safeLength > ctx.bufferOffset) {
      const dataChunk = ctx.buffer.subarray(ctx.bufferOffset, safeLength);
      processPartData(ctx, dataChunk);
      ctx.bufferOffset = safeLength;
    } else {
      // Not enough data to process safely
      ctx.bufferOffset = ctx.buffer.length;
    }
  }
}

/**
 * Find a boundary in the buffer
 */
function findBoundary(buf: Buffer, startIndex: number, boundaryBuffer: Buffer): number {
  return buf.indexOf(boundaryBuffer, startIndex);
}

/**
 * Find an end boundary in the buffer
 */
function findEndBoundary(buf: Buffer, startIndex: number, endBoundaryBuffer: Buffer): number {
  return buf.indexOf(endBoundaryBuffer, startIndex);
}

/**
 * Parse header text into header object
 */
function parseHeaders(ctx: ParserContext, headersText: string): void {
  // Reset current headers
  ctx.currentHeaders = {};
  ctx.currentName = '';
  ctx.currentFilename = '';

  // Process each header line
  const headerLines = (ctx.headerBuffer + headersText).split('\r\n');
  ctx.headerBuffer = ''; // Reset the accumulated header buffer

  for (const line of headerLines) {
    if (!line) continue;

    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const name = line.slice(0, colonIndex).trim().toLowerCase();
      const value = line.slice(colonIndex + 1).trim();
      ctx.currentHeaders[name] = value;

      // Extract content-disposition details
      if (name === 'content-disposition') {
        const nameMatch = /name="([^"]*)"/.exec(value);
        const filenameMatch = /filename="([^"]*)"/.exec(value);

        if (nameMatch) ctx.currentName = nameMatch[1]!;
        if (filenameMatch) ctx.currentFilename = filenameMatch[1]!;
      }
    }
  }
}

/**
 * Set up for receiving part data
 */
function setupPartReceiver(ctx: ParserContext): void {
  // Check field count limit
  if (++ctx.fieldCount > ctx.config.maxFields) {
    throw new Error(`Maximum number of fields (${ctx.config.maxFields}) exceeded`);
  }

  // Reset part tracking
  ctx.currentPart = null;
  ctx.currentFieldSize = 0;

  // Set up appropriate receiver based on content-disposition
  if (ctx.currentFilename) {
    setupFileReceiver(ctx).catch(err => {
      throw new Error(`Error setting up file receiver: ${err.message}`);
    });
  } else {
    setupFieldReceiver(ctx);
  }
}

/**
 * Set up for receiving a file
 */
async function setupFileReceiver(ctx: ParserContext): Promise<void> {
  // Generate a temporary file path
  const tmpdir = ctx.config.uploadDir;
  const randomPrefix = randomBytes(16).toString('hex');
  ctx.tempFilePath = join(tmpdir, `multipart-${randomPrefix}`);

  // Ensure the directory exists
  await mkdir(dirname(ctx.tempFilePath), { recursive: true });

  // Create the file stream
  ctx.currentFileStream = createWriteStream(ctx.tempFilePath);
  ctx.currentFileSize = 0;

  // Create a new file entry
  const file: MultipartFile = {
    fieldname: ctx.currentName,
    originalname: ctx.currentFilename,
    encoding: ctx.currentHeaders['content-transfer-encoding'] || 'binary',
    mimetype: ctx.currentHeaders['content-type'] || 'application/octet-stream',
    path: ctx.tempFilePath,
    size: 0,
    truncated: false
  };

  // Add to files object
  if (ctx.files[ctx.currentName]) {
    // If we already have a file with this name, convert to array
    if (Array.isArray(ctx.files[ctx.currentName])) {
      (ctx.files[ctx.currentName] as MultipartFile[]).push(file);
    } else {
      ctx.files[ctx.currentName] = [ctx.files[ctx.currentName] as MultipartFile, file];
    }
  } else {
    ctx.files[ctx.currentName] = file;
  }
}

/**
 * Set up for receiving a field
 */
function setupFieldReceiver(ctx: ParserContext): void {
  ctx.currentPart = Buffer.allocUnsafe(0);
  ctx.currentFieldSize = 0;
}

/**
 * Process a chunk of part data
 */
function processPartData(ctx: ParserContext, data: Buffer): void {
  if (ctx.currentFilename && ctx.currentFileStream) {
    // Handle file data
    ctx.currentFileSize += data.length;

    // Check file size limit
    if (ctx.currentFileSize > ctx.config.maxFileSize) {
      // Mark as truncated, but keep writing
      const file = getLastFile(ctx);
      if (file) {
        file.truncated = true;
      }
    }

    // Write to file stream
    ctx.currentFileStream.write(data);
  } else {
    // Handle field data
    ctx.currentFieldSize += data.length;

    // Check field size limit
    if (ctx.currentFieldSize > ctx.config.maxFieldSize) {
      throw new Error(`Field size exceeds limit (${ctx.config.maxFieldSize} bytes)`);
    }

    // Append to part buffer
    const newPart = Buffer.allocUnsafe(
      ctx.currentPart ? ctx.currentPart.length + data.length : data.length
    );
    if (ctx.currentPart) {
      ctx.currentPart.copy(newPart);
      data.copy(newPart, ctx.currentPart.length);
    } else {
      data.copy(newPart);
    }
    ctx.currentPart = newPart;
  }
}

/**
 * Get the most recent file in the files list
 */
function getLastFile(ctx: ParserContext): MultipartFile | null {
  const fileEntry = ctx.files[ctx.currentName];
  if (!fileEntry) return null;

  if (Array.isArray(fileEntry)) {
    return fileEntry[fileEntry.length - 1]!;
  }
  return fileEntry;
}

/**
 * Finish processing the current part
 */
function finishCurrentPart(ctx: ParserContext): void {
  if (ctx.currentFilename && ctx.currentFileStream) {
    // Finish file
    ctx.currentFileStream.end();
    ctx.currentFileStream = null;

    // Update file size
    const file = getLastFile(ctx);
    if (file) {
      file.size = ctx.currentFileSize;
    }
  } else if (ctx.currentPart) {
    // Finish field
    ctx.fields[ctx.currentName] = ctx.currentPart.toString();
    ctx.currentPart = null;
  }

  // Reset for next part
  ctx.currentFieldSize = 0;
  ctx.currentName = '';
  ctx.currentFilename = '';
  ctx.currentHeaders = {};
}

/**
 * Create a parser for multipart/form-data
 * @param options - Parser options
 * @returns A transform stream that parses multipart data
 */
export function createMultipartParser(options: MultipartParserOptions = {}): OptimizedTransform {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const boundary = config.boundary || '';

  if (!boundary) {
    throw new Error('Boundary is required for multipart parsing');
  }

  // Create parser context
  const ctx: ParserContext = {
    state: ParserState.PENDING_BOUNDARY,
    config,
    boundaryBuffer: Buffer.from(`\r\n--${boundary}`),
    endBoundaryBuffer: Buffer.from(`\r\n--${boundary}--`),
    currentHeaders: {},
    currentName: '',
    currentFilename: '',
    currentPart: null,
    currentFieldSize: 0,
    headerBuffer: '',
    currentFileStream: null,
    currentFileSize: 0,
    tempFilePath: '',
    fields: {},
    files: {},
    fieldCount: 0,
    buffer: null,
    bufferOffset: 0
  };

  // Create a custom transform stream with buffer pooling
  return createOptimizedTransform({
    objectMode: true,

    transform(chunk: Buffer, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
      try {
        processChunk(ctx, chunk);
        callback();
      } catch (err) {
        callback(err instanceof Error ? err : new Error(String(err)));
      }
    },

    flush(callback: (error?: Error | null) => void) {
      try {
        // Clean up any open file streams
        if (ctx.currentFileStream) {
          ctx.currentFileStream.end();
          ctx.currentFileStream = null;
        }

        // Push the final results once
        this.push({ fields: ctx.fields, files: ctx.files });

        callback();
      } catch (err) {
        callback(err instanceof Error ? err : new Error(String(err)));
      }
    }
  });
}

/**
 * Parse a multipart form data request
 * @param req - HTTP request object
 * @param options - Parser options
 * @returns Promise that resolves with parsed fields and files
 */
export function parseMultipartRequest(
  req: IncomingMessage,
  options: MultipartParserOptions = {}
): Promise<MultipartResult> {
  return new Promise((resolve, reject) => {
    // Get the content type and boundary
    const contentType = req.headers['content-type'];
    if (!contentType) {
      return reject(new Error('Content-Type header is missing'));
    }

    if (!contentType.includes('multipart/form-data')) {
      return reject(new Error('Content-Type must be multipart/form-data'));
    }

    const boundary = extractBoundary(contentType);
    if (!boundary) {
      return reject(new Error('Boundary not found in Content-Type header'));
    }

    // Create parser with the extracted boundary
    const parser = createMultipartParser({
      ...options,
      boundary
    });

    // Handle parser errors
    parser.on('error', err => {
      // Clean up any temporary files if not keeping them
      if (!options.keepFiles) {
        cleanupFiles();
      }
      reject(err);
    });

    // Handle parser data
    parser.on('data', result => {
      // Clean up temporary files if not keeping them
      if (!options.keepFiles) {
        process.nextTick(cleanupFiles);
      }
      resolve(result);
    });

    // Pipe request to parser
    req.pipe(parser);

    /**
     * Clean up any temporary files
     */
    function cleanupFiles(): void {
      const allFiles = getFilesArray(parser.read()?.files || {});
      for (const file of allFiles) {
        try {
          unlinkSync(file.path);
        } catch (_err) {
          // Ignore deletion errors
        }
      }
    }

    /**
     * Convert files object to flat array
     * @param files - Files object from parser
     * @returns Array of all files
     */
    function getFilesArray(files: MultipartFiles): MultipartFile[] {
      const result: MultipartFile[] = [];

      Object.values(files).forEach(file => {
        if (Array.isArray(file)) {
          result.push(...file);
        } else {
          result.push(file);
        }
      });

      return result;
    }
  });
}

export default {
  createMultipartParser,
  parseMultipartRequest
};
