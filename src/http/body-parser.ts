import { IncomingMessage } from 'node:http';
import { Readable, Transform } from 'node:stream';
import { URLSearchParams } from 'node:url';
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { globalPool } from '../utils/buffer-pool';
import { createJsonTransformer, createTextTransformer } from '../utils/stream-optimizer';
import {
  hasBody,
  getContentType,
  parseUrlEncodedText as parseUrlEncodedString
} from '../utils/http-utils';
import { HttpException } from './http-exception';

/**
 * Body parsing configuration options
 */
export interface BodyParserOptions {
  /**
   * Maximum size for buffering request bodies in memory (in bytes)
   * Requests larger than this will be processed as streams
   * @default 1048576 (1MB)
   */
  maxBufferSize?: number;

  /**
   * Directory for temporary files when streaming large request bodies
   * @default os.tmpdir()
   */
  tempDir?: string;

  /**
   * Maximum request body size allowed (in bytes)
   * @default 104857600 (100MB)
   */
  maxBodySize?: number;

  /**
   * Whether to keep temporary files after request processing
   * @default false
   */
  keepFiles?: boolean;

  /**
   * Always process as stream regardless of size
   * @default false
   */
  alwaysStream?: boolean;

  /**
   * Stream chunk size for optimized memory usage
   * @default 16384 (16KB)
   */
  streamChunkSize?: number;

  /**
   * Whether to store the raw stream as a property on the request
   * Useful for custom stream processing middleware
   * @default false
   */
  exposeStream?: boolean;

  /**
   * Custom stream transformers to apply to request bodies
   * These are applied in order before content-type processing
   */
  streamTransformers?: Transform[];
}

// Default options
const _DEFAULT_OPTIONS: Required<BodyParserOptions> = {
  maxBufferSize: 1024 * 1024, // 1MB
  tempDir: tmpdir(),
  maxBodySize: 100 * 1024 * 1024, // 100MB
  keepFiles: false,
  alwaysStream: false,
  streamChunkSize: 16 * 1024, // 16KB
  exposeStream: false,
  streamTransformers: []
};

// Default timeout for body parsing (in milliseconds)
const _DEFAULT_PARSE_TIMEOUT = 30000; // 30 seconds

/**
 * Parse the request body using optimized streaming techniques
 * Options include:
 * - limit: maximum body size (default 1mb)
 * - encoding: content encoding (default utf-8)
 * - type: content type to parse (json, text, raw, urlencoded, etc.)
 * - timeout: timeout in milliseconds for body parsing
 *
 * @param {Object} options - Configuration options
 * @returns {Function} - Middleware function
 */
export function bodyParser(
  options: any = {}
): (req: IncomingMessage, res: any, next: () => Promise<void>) => Promise<void> {
  return async function bodyParserMiddleware(
    req: IncomingMessage,
    res: any,
    next: () => Promise<void>
  ) {
    if (!hasBody(req)) {
      return next();
    }

    try {
      const contentType = getContentType(req);
      const contentLength = parseInt((req.headers['content-length'] as string) || '0');
      const _encoding = (req.headers['content-_encoding'] as string) || 'utf-8';

      // Check max size
      const maxSize = options.maxBodySize || 1024 * 1024 * 100; // 100MB default
      if (contentLength > maxSize) {
        throw new Error(`Request body too large: ${contentLength} bytes`);
      }

      if (/application\/json/.test(contentType)) {
        (req as any).body = await parseJson(req, options);
      } else if (/text\/plain/.test(contentType)) {
        (req as any).body = await parseText(req, options);
      } else if (/application\/x-www-form-urlencoded/.test(contentType)) {
        (req as any).body = await parseUrlEncoded(req, options);
      } else if (/multipart\/form-data/.test(contentType)) {
        (req as any).body = await parseMultipart(req, options);
      } else {
        (req as any).body = await parseRaw(req, options);
      }

      await next();
    } catch (error) {
      throw error;
    }
  };
}

/**
 * Parse JSON body using optimized streaming
 */
async function parseJson(req: any, options: any = {}): Promise<any> {
  const { maxBytes, _encoding } = options;

  return new Promise((resolve, reject) => {
    // Create an optimized JSON transformer
    const jsonTransformer = createJsonTransformer({
      processJson: data => {
        // Store parsed result when complete
        req.body = data;
        return undefined; // Don't push data
      },
      processError: _err => {
        const error = new SyntaxError('Invalid JSON');
        (error as any).status = 400;
        (error as any).body = req.body || '';
        reject(error);
      }
    });

    // Handle end
    jsonTransformer.on('end', () => resolve(req.body));

    // Handle error
    jsonTransformer.on('error', err => {
      if ((err as any).code === 'ECONNABORTED') {
        const timeoutErr = new Error('Request timeout');
        (timeoutErr as any).status = 408;
        return reject(timeoutErr);
      }

      reject(err);
    });

    // Pipe request to parser
    let bytes = 0;
    req.pipe(jsonTransformer).on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        const err = new Error('Request entity too large');
        (err as any).status = 413;
        (err as any).type = 'entity.too.large';
        jsonTransformer.destroy(err);
      }
    });
  });
}

/**
 * Parse text body using optimized streaming
 */
async function parseText(req: any, options: any = {}): Promise<string> {
  const { maxBytes, _encoding } = options;

  return new Promise((resolve, reject) => {
    // Create an optimized text transformer
    const textTransformer = createTextTransformer({
      processText: text => {
        req.body = text;
        return undefined; // Don't push data
      }
    });

    // Handle end
    textTransformer.on('end', () => resolve(req.body));

    // Handle error
    textTransformer.on('error', err => reject(err));

    // Pipe request to parser
    let bytes = 0;
    req.pipe(textTransformer).on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        const err = new Error('Request entity too large');
        (err as any).status = 413;
        (err as any).type = 'entity.too.large';
        textTransformer.destroy(err);
      }
    });
  });
}

/**
 * Parse raw body using optimized buffer pooling
 */
async function parseRaw(req: any, options: any = {}): Promise<Buffer> {
  const { maxBytes } = options;

  return new Promise((resolve, reject) => {
    // Use buffer pooling for efficiency
    const chunks: Buffer[] = [];
    let bytes = 0;

    req.on('data', (chunk: Buffer) => {
      bytes += chunk.length;

      if (bytes > maxBytes) {
        req.unpipe();
        const err = new Error('Request entity too large');
        (err as any).status = 413;
        (err as any).type = 'entity.too.large';
        reject(err);
        return;
      }

      // Get a buffer from the pool and copy the chunk
      const pooledBuffer = globalPool.acquire(chunk.length);
      chunk.copy(pooledBuffer);
      chunks.push(pooledBuffer);
    });

    req.on('end', () => {
      // Combine all chunks into a single buffer
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const body = Buffer.concat(chunks, totalLength);

      // Release buffers back to pool
      chunks.forEach(chunk => globalPool.release(chunk));

      // Store raw body
      req.body = body;
      resolve(body);
    });

    req.on('error', (err: Error) => {
      // Release buffers back to pool
      chunks.forEach(chunk => globalPool.release(chunk));
      reject(err);
    });
  });
}

/**
 * Parse URL-encoded request body
 * @param req The incoming request
 */
async function parseUrlEncoded(
  req: IncomingMessage,
  options: Required<BodyParserOptions>
): Promise<Record<string, string>> {
  try {
    const raw = await parseRaw(req, options);
    const text = raw.toString();
    return parseUrlEncodedString(text);
  } catch (_error) {
    throw HttpException.badRequest('Invalid URL-encoded body');
  }
}

/**
 * Parse URL-encoded request body as a stream
 * @param req The incoming request
 * @param options Body parser options
 */
async function _parseUrlEncodedStream(
  req: IncomingMessage,
  options: Required<BodyParserOptions>
): Promise<Record<string, string>> {
  try {
    // Create a URL-encoded parser stream
    const urlEncodedChunks: Buffer[] = [];

    const urlEncodedParser = new Transform({
      transform(chunk, _encoding, callback): void {
        try {
          urlEncodedChunks.push(Buffer.from(chunk));
          callback(null, chunk);
        } catch (err) {
          callback(err instanceof Error ? err : new Error(String(err)));
        }
      }
    });

    // For large data, stream to disk
    if (parseInt(req.headers['content-length'] || '0', 10) > options.maxBufferSize * 5) {
      const tempFilePath = await streamToTempFile(req, options);
      const content = await readTempFile(tempFilePath);

      if (!options.keepFiles) {
        // Remove temp file
        cleanupTempFile(tempFilePath);
      }

      return parseUrlEncodedString(content);
    } else {
      // Process directly in memory
      await pipeline(req, urlEncodedParser);

      // Combine chunks and parse
      const buffer = Buffer.concat(urlEncodedChunks);
      return parseUrlEncodedString(buffer.toString());
    }
  } catch (error) {
    throw HttpException.badRequest(`Invalid URL-encoded body: ${(error as Error).message}`);
  }
}

/**
 * Parse URL-encoded text into an object
 * @param text URL-encoded text
 */
function _parseUrlEncodedText(text: string): Record<string, string> {
  const params = new URLSearchParams(text);
  const result: Record<string, string> = {};

  // Convert URLSearchParams entries to object with Array.from for better compatibility
  Array.from(params.entries()).forEach(([key, value]) => {
    result[key] = value;
  });

  return result;
}

/**
 * Parse multipart form data request body
 * This implementation now properly handles streaming for multipart data
 * @param req The incoming request
 * @param options Body parser options
 */
async function parseMultipart(
  req: IncomingMessage,
  options: Required<BodyParserOptions>
): Promise<any> {
  // For a complete implementation, you would use a library like formidable or busboy
  // or implement a more robust multipart parser

  // If content length is large, always stream to temp file
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);

  if (contentLength > options.maxBufferSize || options.alwaysStream) {
    const tempFilePath = await streamToTempFile(req, options);

    // Return a special object that indicates this is a file
    // In a real implementation, you would parse the multipart data and extract fields/files
    return {
      _raw: tempFilePath,
      _isFile: true,
      _contentType: req.headers['content-type'],
      _contentLength: contentLength,
      _keepFile: options.keepFiles
    };
  } else {
    // For smaller multipart data, buffer in memory
    const raw = await parseRaw(req, options);

    // Return the raw buffer for now
    // In a real implementation, you would parse the multipart data
    return {
      _raw: raw,
      _isFile: false,
      _contentType: req.headers['content-type'],
      _contentLength: contentLength
    };
  }
}

/**
 * Stream request body to a temporary file
 * @param req The incoming request
 * @param options Body parser options
 * @returns Path to the temporary file
 */
async function streamToTempFile(
  req: IncomingMessage,
  options: Required<BodyParserOptions>
): Promise<string> {
  return new Promise((resolve, reject) => {
    const tempFilePath = join(options.tempDir, `nexure-body-${randomBytes(8).toString('hex')}`);
    const writeStream = createWriteStream(tempFilePath);

    let totalBytes = 0;
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);

    // Create a transform stream to monitor the size
    const sizeMonitor = new Transform({
      highWaterMark: options.streamChunkSize,
      transform(chunk, _encoding, callback): void {
        totalBytes += chunk.length;

        // Check if body exceeds max size during streaming
        if (options.maxBodySize > 0 && totalBytes > options.maxBodySize) {
          this.destroy(HttpException.badRequest('Request body too large'));
          return;
        }

        // Check if body exceeds declared size
        if (contentLength > 0 && totalBytes > contentLength) {
          this.destroy(HttpException.badRequest('Request body larger than declared size'));
          return;
        }

        callback(null, chunk);
      }
    });

    // Apply custom transformers if provided
    let source: Readable = req;

    if (options.streamTransformers.length > 0) {
      // Chain all transformers
      for (const transformer of options.streamTransformers) {
        source = source.pipe(transformer);
      }
    }

    // Pipe through the size monitor to the file
    pipeline(source, sizeMonitor, writeStream)
      .then(() => resolve(tempFilePath))
      .catch(err => {
        // Clean up file on error
        cleanupTempFile(tempFilePath);
        reject(
          err instanceof HttpException
            ? err
            : HttpException.badRequest('Error processing request body')
        );
      });
  });
}

/**
 * Read a temporary file as a string
 * @param path Path to the temporary file
 */
async function readTempFile(path: string): Promise<string> {
  const { readFile } = await import('node:fs/promises');
  try {
    const data = await readFile(path, 'utf8');
    return data;
  } catch (_error) {
    throw HttpException.internal('Error reading temporary file');
  }
}

/**
 * Read a temporary file as a buffer
 * @param path Path to the temporary file
 */
async function _readTempFileAsBuffer(path: string): Promise<Buffer> {
  const { readFile } = await import('node:fs/promises');
  try {
    const data = await readFile(path);
    return data;
  } catch (_error) {
    throw HttpException.internal('Error reading temporary file');
  }
}

/**
 * Clean up a temporary file
 * @param path Path to the temporary file
 */
async function cleanupTempFile(path: string): Promise<void> {
  const { unlink } = await import('node:fs/promises');
  try {
    await unlink(path);
  } catch (_error) {
    // Silently fail on cleanup errors
    console.warn(`Failed to clean up temporary file: ${path}`);
  }
}

/**
 * Create a body parser middleware with custom options
 * @param options Body parser options
 */
export function createBodyParserMiddleware(
  options: BodyParserOptions = {}
): (req: IncomingMessage, _res: any, next: () => Promise<void>) => Promise<void> {
  return async (req: IncomingMessage, _res: any, next: () => Promise<void>) => {
    try {
      (req as any).body = await parseBody(req, options);
      await next();
    } catch (error) {
      throw error;
    }
  };
}

/**
 * Parse request body based on content type
 */
export async function parseBody(
  req: IncomingMessage,
  options: Partial<BodyParserOptions> = {}
): Promise<any> {
  // Default options
  const defaultOptions = {
    maxBufferSize: 1024 * 1024, // 1MB
    tempDir: tmpdir(),
    maxBodySize: 100 * 1024 * 1024, // 100MB
    keepFiles: false,
    alwaysStream: false,
    streamChunkSize: 16 * 1024, // 16KB
    exposeStream: false,
    streamTransformers: []
  };

  // Merge options
  const mergedOptions = { ...defaultOptions, ...options };

  // Return if no body
  if (!hasBody(req)) {
    return {};
  }

  // Check for content-type
  const contentType = getContentType(req);

  // Parse based on content type
  if (/application\/json/.test(contentType)) {
    return await parseJson(req, mergedOptions);
  } else if (/text\/plain/.test(contentType)) {
    const _encoding = req.headers['content-_encoding'] || 'utf-8';
    return await parseText(req, mergedOptions);
  } else if (/application\/x-www-form-urlencoded/.test(contentType)) {
    return await parseUrlEncoded(req, mergedOptions);
  } else if (/multipart\/form-data/.test(contentType)) {
    return await parseMultipart(req, mergedOptions);
  } else {
    return await parseRaw(req, mergedOptions);
  }
}
