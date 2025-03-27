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

  // Full boundary string with leading CRLF
  const boundaryBuffer = Buffer.from(`\r\n--${boundary}`);
  const endBoundaryBuffer = Buffer.from(`\r\n--${boundary}--`);

  // Parser state
  let state = ParserState.PENDING_BOUNDARY;
  let currentHeaders: Record<string, string> = {};
  let currentName = '';
  let currentFilename = '';
  let currentPart: Buffer | null = null;
  let currentFieldSize = 0;
  let headerBuffer = '';
  let currentFileStream: Writable | null = null;
  let currentFileSize = 0;
  let tempFilePath = '';

  // Results collection
  const fields: MultipartFields = {};
  const files: MultipartFiles = {};
  let fieldCount = 0;

  // Tracking boundaries in the buffer
  let buffer: Buffer | null = null;
  let bufferOffset = 0;

  // Create a custom transform stream with buffer pooling
  return createOptimizedTransform({
    objectMode: true,

    transform(chunk: Buffer, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
      try {
        processChunk(chunk);
        callback();
      } catch (err) {
        callback(err instanceof Error ? err : new Error(String(err)));
      }
    },

    flush(callback: (error?: Error | null) => void) {
      try {
        // Clean up any open file streams
        if (currentFileStream) {
          currentFileStream.end();
          currentFileStream = null;
        }

        // Push the final results once
        this.push({ fields, files });

        callback();
      } catch (err) {
        callback(err instanceof Error ? err : new Error(String(err)));
      }
    }
  });

  /**
   * Process a chunk of data
   * @param chunk - The data to process
   */
  function processChunk(chunk: Buffer): void {
    // If this is the first chunk, handle special case
    if (state === ParserState.PENDING_BOUNDARY && !buffer) {
      // First chunk may start with the boundary without the leading CRLF
      const firstBoundary = `--${boundary}`;
      const firstBoundaryBuffer = Buffer.from(firstBoundary);

      // Check if the chunk starts with the boundary
      if (chunk.length >= firstBoundaryBuffer.length &&
          chunk.subarray(0, firstBoundaryBuffer.length).equals(firstBoundaryBuffer)) {

        // This is the first boundary, start processing headers from after it
        buffer = chunk.subarray(firstBoundaryBuffer.length);
        bufferOffset = 0;
        state = ParserState.PENDING_HEADERS;
        return;
      }
    }

    // Append chunk to existing buffer or create a new one
    if (buffer) {
      const newBuffer = globalPool.acquire(buffer.length - bufferOffset + chunk.length);
      buffer.copy(newBuffer, 0, bufferOffset);
      chunk.copy(newBuffer, buffer.length - bufferOffset);

      // Release the old buffer back to the pool
      globalPool.release(buffer);

      buffer = newBuffer;
      bufferOffset = 0;
    } else {
      buffer = chunk;
      bufferOffset = 0;
    }

    // Process the buffer based on current state
    processBuffer();
  }

  /**
   * Process the current buffer
   */
  function processBuffer(): void {
    while (buffer && bufferOffset < buffer.length) {
      switch (state) {
        case ParserState.PENDING_BOUNDARY:
          processPendingBoundary();
          break;

        case ParserState.PENDING_HEADERS:
          processPendingHeaders();
          break;

        case ParserState.PENDING_DATA:
          processPendingData();
          break;

        case ParserState.BOUNDARY_REACHED:
          // Clean up the current part if any
          finishCurrentPart();

          // Move past the boundary
          bufferOffset += 2; // Skip CRLF after boundary
          state = ParserState.PENDING_HEADERS;
          break;

        case ParserState.COMPLETE:
          // We're done parsing
          return;
      }

      // If we've consumed the entire buffer, release it back to the pool
      if (buffer && bufferOffset >= buffer.length) {
        globalPool.release(buffer);
        buffer = null;
        bufferOffset = 0;
      }
    }
  }

  /**
   * Process buffer when expecting a boundary
   */
  function processPendingBoundary(): void {
    if (!buffer) return;

    // Look for the boundary in the buffer
    const boundaryIndex = findBoundary(buffer, bufferOffset);

    if (boundaryIndex >= 0) {
      bufferOffset = boundaryIndex + boundaryBuffer.length;
      state = ParserState.PENDING_HEADERS;
    } else {
      // Boundary not found yet, move past the buffer
      bufferOffset = buffer.length;
    }
  }

  /**
   * Process buffer when expecting headers
   */
  function processPendingHeaders(): void {
    if (!buffer) return;

    // Find end of headers (double CRLF)
    const index = buffer.indexOf('\r\n\r\n', bufferOffset, 'utf8');

    if (index >= 0) {
      // Extract headers text
      const headersText = buffer.subarray(bufferOffset, index).toString();
      bufferOffset = index + 4; // Move past double CRLF

      // Parse headers
      parseHeaders(headersText);

      // Set up for receiving data
      setupPartReceiver();

      state = ParserState.PENDING_DATA;
    } else {
      // Headers not yet complete
      headerBuffer += buffer.subarray(bufferOffset).toString();
      bufferOffset = buffer.length;

      // Check if headers are too long
      if (headerBuffer.length > 16 * 1024) {
        throw new Error('Headers too large');
      }
    }
  }

  /**
   * Process buffer when expecting part data
   */
  function processPendingData(): void {
    if (!buffer) return;

    // Look for the next boundary
    const boundaryIndex = findBoundary(buffer, bufferOffset);
    const endBoundaryIndex = findEndBoundary(buffer, bufferOffset);

    if (endBoundaryIndex >= 0) {
      // Found end boundary - parse data up to it
      const dataChunk = buffer.subarray(bufferOffset, endBoundaryIndex);
      processPartData(dataChunk);

      // Finish the current part
      finishCurrentPart();

      // Move past the end boundary
      bufferOffset = endBoundaryIndex + endBoundaryBuffer.length;
      state = ParserState.COMPLETE;
    } else if (boundaryIndex >= 0) {
      // Found normal boundary - parse data up to it
      const dataChunk = buffer.subarray(bufferOffset, boundaryIndex);
      processPartData(dataChunk);

      // Move to boundary handling state
      bufferOffset = boundaryIndex + boundaryBuffer.length;
      state = ParserState.BOUNDARY_REACHED;
    } else {
      // No boundary found - process all but the last possible boundary match
      const safeLength = buffer.length - boundaryBuffer.length - 1;

      if (safeLength > bufferOffset) {
        const dataChunk = buffer.subarray(bufferOffset, safeLength);
        processPartData(dataChunk);
        bufferOffset = safeLength;
      } else {
        // Not enough data to process safely
        bufferOffset = buffer.length;
      }
    }
  }

  /**
   * Find a boundary in the buffer
   * @param buf - Buffer to search in
   * @param startIndex - Starting index for search
   * @returns Index of boundary or -1 if not found
   */
  function findBoundary(buf: Buffer, startIndex: number): number {
    return buf.indexOf(boundaryBuffer, startIndex);
  }

  /**
   * Find an end boundary in the buffer
   * @param buf - Buffer to search in
   * @param startIndex - Starting index for search
   * @returns Index of end boundary or -1 if not found
   */
  function findEndBoundary(buf: Buffer, startIndex: number): number {
    return buf.indexOf(endBoundaryBuffer, startIndex);
  }

  /**
   * Parse header text into header object
   * @param headersText - Raw headers text
   */
  function parseHeaders(headersText: string): void {
    // Reset current headers
    currentHeaders = {};
    currentName = '';
    currentFilename = '';

    // Process each header line
    const headerLines = (headerBuffer + headersText).split('\r\n');
    headerBuffer = ''; // Reset the accumulated header buffer

    for (const line of headerLines) {
      if (!line) continue;

      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const name = line.slice(0, colonIndex).trim().toLowerCase();
        const value = line.slice(colonIndex + 1).trim();
        currentHeaders[name] = value;

        // Extract content-disposition details
        if (name === 'content-disposition') {
          const nameMatch = /name="([^"]*)"/.exec(value);
          const filenameMatch = /filename="([^"]*)"/.exec(value);

          if (nameMatch) currentName = nameMatch[1];
          if (filenameMatch) currentFilename = filenameMatch[1];
        }
      }
    }
  }

  /**
   * Set up for receiving part data
   */
  function setupPartReceiver(): void {
    // Check field count limit
    if (++fieldCount > config.maxFields) {
      throw new Error(`Maximum number of fields (${config.maxFields}) exceeded`);
    }

    // Reset part tracking
    currentPart = null;
    currentFieldSize = 0;

    // Set up appropriate receiver based on content-disposition
    if (currentFilename) {
      setupFileReceiver().catch(err => {
        throw new Error(`Error setting up file receiver: ${err.message}`);
      });
    } else {
      setupFieldReceiver();
    }
  }

  /**
   * Set up for receiving a file
   */
  async function setupFileReceiver(): Promise<void> {
    // Generate a temporary file path
    const tmpdir = config.uploadDir;
    const randomPrefix = randomBytes(16).toString('hex');
    tempFilePath = join(tmpdir, `multipart-${randomPrefix}`);

    // Ensure the directory exists
    await mkdir(dirname(tempFilePath), { recursive: true });

    // Create the file stream
    currentFileStream = createWriteStream(tempFilePath);
    currentFileSize = 0;

    // Create a new file entry
    const file: MultipartFile = {
      fieldname: currentName,
      originalname: currentFilename,
      encoding: currentHeaders['content-transfer-encoding'] || 'binary',
      mimetype: currentHeaders['content-type'] || 'application/octet-stream',
      path: tempFilePath,
      size: 0,
      truncated: false
    };

    // Add to files object
    if (files[currentName]) {
      // If we already have a file with this name, convert to array
      if (Array.isArray(files[currentName])) {
        (files[currentName] as MultipartFile[]).push(file);
      } else {
        files[currentName] = [files[currentName] as MultipartFile, file];
      }
    } else {
      files[currentName] = file;
    }
  }

  /**
   * Set up for receiving a field
   */
  function setupFieldReceiver(): void {
    currentPart = Buffer.allocUnsafe(0);
    currentFieldSize = 0;
  }

  /**
   * Process a chunk of part data
   * @param data - Data chunk to process
   */
  function processPartData(data: Buffer): void {
    if (currentFilename && currentFileStream) {
      // Handle file data
      currentFileSize += data.length;

      // Check file size limit
      if (currentFileSize > config.maxFileSize) {
        // Mark as truncated, but keep writing
        const file = getLastFile();
        if (file) {
          file.truncated = true;
        }
      }

      // Write to file stream
      currentFileStream.write(data);
    } else {
      // Handle field data
      currentFieldSize += data.length;

      // Check field size limit
      if (currentFieldSize > config.maxFieldSize) {
        throw new Error(`Field size exceeds limit (${config.maxFieldSize} bytes)`);
      }

      // Append to part buffer
      const newPart = Buffer.allocUnsafe(currentPart ? currentPart.length + data.length : data.length);
      if (currentPart) {
        currentPart.copy(newPart);
        data.copy(newPart, currentPart.length);
      } else {
        data.copy(newPart);
      }
      currentPart = newPart;
    }
  }

  /**
   * Get the most recent file in the files list
   */
  function getLastFile(): MultipartFile | null {
    const fileEntry = files[currentName];
    if (!fileEntry) return null;

    if (Array.isArray(fileEntry)) {
      return fileEntry[fileEntry.length - 1];
    }
    return fileEntry;
  }

  /**
   * Finish processing the current part
   */
  function finishCurrentPart(): void {
    if (currentFilename && currentFileStream) {
      // Finish file
      currentFileStream.end();
      currentFileStream = null;

      // Update file size
      const file = getLastFile();
      if (file) {
        file.size = currentFileSize;
      }
    } else if (currentPart) {
      // Finish field
      fields[currentName] = currentPart.toString();
      currentPart = null;
    }

    // Reset for next part
    currentFieldSize = 0;
    currentName = '';
    currentFilename = '';
    currentHeaders = {};
  }
}

/**
 * Parse a multipart form data request
 * @param req - HTTP request object
 * @param options - Parser options
 * @returns Promise that resolves with parsed fields and files
 */
export function parseMultipartRequest(req: IncomingMessage, options: MultipartParserOptions = {}): Promise<MultipartResult> {
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
