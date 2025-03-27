/**
 * Stream Transformation Middleware
 *
 * This module provides middleware for transforming request and response bodies
 * using Node.js streams. This is particularly useful for processing large files
 * or request bodies without loading the entire content into memory.
 */

import { IncomingMessage } from 'node:http';
import { Readable, Transform, PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip, createGunzip, ZlibOptions } from 'node:zlib';
import { createCipheriv, createDecipheriv, randomBytes, CipherGCMTypes, CipherCCMTypes } from 'node:crypto';
import { createOptimizedTransform, createTextTransformer, createJsonTransformer } from '../utils/stream-optimizer';
import { globalTimeoutManager, TimeoutHandler } from '../utils/adaptive-timeout';
import { hasBody } from '../utils/http-utils';

/**
 * Configuration options for stream processing
 */
export interface StreamProcessingOptions {
  /**
   * Maximum size in bytes to buffer in memory (larger will use temp files)
   * @default 1048576 (1MB)
   */
  maxBufferSize?: number;

  /**
   * Size of chunks to process at a time
   * @default 16384 (16KB)
   */
  chunkSize?: number;

  /**
   * Minimum size in bytes required to enable streaming
   * Requests smaller than this will be buffered
   * @default 4096 (4KB)
   */
  streamThreshold?: number;

  /**
   * Whether to expose the raw stream on the request object
   * @default false
   */
  exposeStream?: boolean;

  /**
   * Content types to transform (undefined = all)
   */
  contentTypes?: string[];

  /**
   * Whether to flush output at each chunk
   * @default false
   */
  flushPerChunk?: boolean;
}

/**
 * Default stream processing options
 */
const DEFAULT_STREAM_OPTIONS: Required<StreamProcessingOptions> = {
  maxBufferSize: 1024 * 1024, // 1MB
  chunkSize: 16 * 1024, // 16KB
  streamThreshold: 4 * 1024, // 4KB
  exposeStream: false,
  contentTypes: [
    'application/json',
    'text/plain',
    'application/x-www-form-urlencoded',
    'application/octet-stream'
  ],
  flushPerChunk: false
};

/**
 * Create a middleware for transforming request bodies with a transform stream
 * @param createTransformStream Function that creates a transform stream
 * @param options Stream processing options
 * @returns Middleware function
 */
export function createStreamTransformMiddleware(
  createTransformStream: (req: IncomingMessage) => Transform,
  options?: StreamProcessingOptions
) {
  const opts = { ...DEFAULT_STREAM_OPTIONS, ...options };

  return async (req: IncomingMessage, _res: any, next: () => Promise<void>) => {
    // Only process requests with bodies
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method || '')) {
      return next();
    }

    // Skip if content-type doesn't match (if specified)
    const contentType = req.headers['content-type'] || '';
    if (opts.contentTypes && opts.contentTypes.length > 0) {
      const shouldProcess = opts.contentTypes.some(type => contentType.includes(type));
      if (!shouldProcess) {
        return next();
      }
    }

    // Check if we should use streaming based on content length
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    const shouldStream = contentLength > opts.streamThreshold || contentLength === 0;

    if (!shouldStream) {
      // Small request, don't bother with streaming
      return next();
    }

    // Save original streams
    const originalPipe = req.pipe.bind(req);
    const originalOn = req.on.bind(req);

    // Create a passthrough stream if exposing
    const passThrough = opts.exposeStream ? new PassThrough() : null;
    if (passThrough) {
      (req as any).bodyStream = passThrough;
    }

    // Create transform stream with the request context
    let transformStream = createTransformStream(req);

    // Set appropriate chunk size for memory optimization
    if (transformStream.readableHighWaterMark !== opts.chunkSize) {
      // Use constructor to create a transform with the desired highWaterMark instead
      const newTransform = new Transform({
        readableHighWaterMark: opts.chunkSize,
        writableHighWaterMark: opts.chunkSize
      });

      // Copy over the transform function from the original
      if (typeof transformStream._transform === 'function') {
        newTransform._transform = transformStream._transform.bind(newTransform);
      }
      if (typeof transformStream._flush === 'function') {
        newTransform._flush = transformStream._flush.bind(newTransform);
      }

      transformStream.pipe(newTransform);
      transformStream = newTransform;
    }

    // Configure auto-flush if needed
    if (opts.flushPerChunk && typeof transformStream._transform === 'function') {
      const originalTransform = transformStream._transform;
      transformStream._transform = function(chunk, encoding, callback) {
        originalTransform.call(this, chunk, encoding, (err, data) => {
          if (err) {
            callback(err);
          } else {
            callback(null, data);
            if (typeof this._flush === 'function') {
              this._flush(() => {
                // Intentionally empty - no action needed after flush completion
              });
            }
          }
        });
      };
    }

    // Create a passthrough stream to collect the transformed data
    const transformedBody = new Readable({
      read() {
        // Intentionally empty - this is a passthrough readable implementation
        // that relies on being pushed data rather than pulling it
      }
    });

    // Replace the request pipe method to intercept reads
    req.pipe = (destination) => {
      const pipeline = transformStream.pipe(destination);

      // Also pipe to passthrough if exposed
      if (passThrough) {
        transformStream.pipe(passThrough);
      }

      // Start the flow
      req.pipe(transformStream);

      return pipeline;
    };

    // Store the original request body for later use
    (req as any).rawBody = req;

    // Store the transformed body stream
    (req as any).transformedBody = transformedBody;

    // Replace the on method to intercept data events
    req.on = ((event, listener) => {
      if (event === 'data' || event === 'end') {
        // Setup the transform pipeline
        (transformStream as any).pipe(transformedBody);

        // Also pipe to passthrough if exposing
        if (passThrough) {
          transformStream.pipe(passThrough);
        }

        // Start the flow from the original request to our transform
        // Cast req to any to avoid TypeScript complaints about pipe method
        (req as any).pipe(transformStream);

        // Listen on the transformed body for the requested event
        return transformedBody.on(event, listener);
      }

      // Pass through for other events
      return originalOn(event, listener);
    }) as typeof req.on;

    await next();

    // Restore original methods
    req.pipe = originalPipe;
    req.on = originalOn;
  };
}

/**
 * Options for compression middleware
 */
export interface CompressionOptions extends StreamProcessingOptions {
  /**
   * Compression level (0-9)
   * @default 6
   */
  level?: number;

  /**
   * Additional zlib options
   */
  zlibOptions?: ZlibOptions;
}

/**
 * Create a compression middleware (gzip)
 * @param options Compression options
 * @returns Middleware function
 */
export function createCompressionMiddleware(options?: CompressionOptions) {
  const level = options?.level ?? 6;
  const zlibOptions = options?.zlibOptions ?? {};

  return createStreamTransformMiddleware(
    () => createGzip({ ...zlibOptions, level }),
    options
  );
}

/**
 * Create a decompression middleware (gunzip)
 * @param options Decompression options
 * @returns Middleware function
 */
export function createDecompressionMiddleware(options?: StreamProcessingOptions) {
  const zlibOptions = (options as CompressionOptions)?.zlibOptions ?? {};

  return createStreamTransformMiddleware(
    () => createGunzip(zlibOptions),
    options
  );
}

/**
 * Options for encryption middleware
 */
export interface EncryptionOptions extends StreamProcessingOptions {
  /**
   * Cipher algorithm to use
   * @default 'aes-256-gcm'
   */
  algorithm?: string;

  /**
   * Authentication tag length for GCM/CCM modes
   * @default 16
   */
  authTagLength?: number;
}

/**
 * Create an encryption middleware
 * @param key Encryption key (defaults to randomly generated key)
 * @param iv Initialization vector (defaults to randomly generated IV)
 * @param options Encryption options
 * @returns Middleware function
 */
export function createEncryptionMiddleware(
  key: Buffer = randomBytes(32),
  iv: Buffer = randomBytes(16),
  options?: EncryptionOptions
) {
  const algorithm = options?.algorithm ?? 'aes-256-gcm';
  const authTagLength = options?.authTagLength ?? 16;

  return createStreamTransformMiddleware(
    () => {
      if (algorithm.endsWith('-gcm')) {
        return createCipheriv(algorithm as CipherGCMTypes, key, iv, { authTagLength });
      } else if (algorithm.endsWith('-ccm')) {
        return createCipheriv(algorithm as CipherCCMTypes, key, iv, { authTagLength });
      } else {
        return createCipheriv(algorithm, key, iv);
      }
    },
    options
  );
}

/**
 * Create a decryption middleware
 * @param key Encryption key (must match the key used for encryption)
 * @param iv Initialization vector (must match the IV used for encryption)
 * @param options Decryption options
 * @returns Middleware function
 */
export function createDecryptionMiddleware(
  key: Buffer,
  iv: Buffer,
  options?: EncryptionOptions
) {
  const algorithm = options?.algorithm ?? 'aes-256-gcm';
  const authTagLength = options?.authTagLength ?? 16;

  return createStreamTransformMiddleware(
    () => {
      if (algorithm.endsWith('-gcm')) {
        return createDecipheriv(algorithm as CipherGCMTypes, key, iv, { authTagLength });
      } else if (algorithm.endsWith('-ccm')) {
        return createDecipheriv(algorithm as CipherCCMTypes, key, iv, { authTagLength });
      } else {
        return createDecipheriv(algorithm, key, iv);
      }
    },
    options
  );
}

/**
 * Options for JSON transformation
 */
export interface JsonTransformOptions extends StreamProcessingOptions {
  /**
   * Whether to validate JSON syntax before transformation
   * @default true
   */
  validate?: boolean;

  /**
   * Whether to handle JSON streams (multiple objects)
   * @default false
   */
  jsonStream?: boolean;

  /**
   * Object separator for JSON streams
   * @default '\n'
   */
  objectSeparator?: string;
}

/**
 * Create a JSON transformation middleware
 * @param transformFn Function to transform the JSON data
 * @param options JSON transform options
 * @returns Middleware function
 */
export function createJsonTransformMiddleware(
  transformFn: (data: any) => any,
  options?: JsonTransformOptions
) {
  const opts = {
    validate: true,
    jsonStream: false,
    objectSeparator: '\n',
    ...options
  };

  return createStreamTransformMiddleware(
    (req) => {
      let buffer = '';
      const contentType = req.headers['content-type'] || '';
      const _isJsonContent = contentType.includes('application/json');

      // Use higher performance options for larger JSON
      const contentLength = parseInt(req.headers['content-length'] || '0', 10);
      const isLargeJson = contentLength > (opts.maxBufferSize || DEFAULT_STREAM_OPTIONS.maxBufferSize);

      return new Transform({
        objectMode: true,
        highWaterMark: opts.chunkSize || DEFAULT_STREAM_OPTIONS.chunkSize,
        transform(chunk, _encoding, callback) {
          try {
            const chunkStr = chunk.toString();

            if (opts.jsonStream) {
              // Handle streaming JSON (one object per line or custom separator)
              const lines = (buffer + chunkStr).split(opts.objectSeparator);
              buffer = lines.pop() || ''; // Last item might be incomplete

              for (const line of lines) {
                if (!line.trim()) continue;

                try {
                  const data = JSON.parse(line);
                  const transformed = transformFn(data);
                  this.push(JSON.stringify(transformed) + opts.objectSeparator);
                } catch (err) {
                  if (opts.validate) {
                    callback(err instanceof Error ? err : new Error(String(err)));
                    return;
                  }
                  // If not validating, just pass through
                  this.push(line + opts.objectSeparator);
                }
              }
              callback();
            } else {
              // Handle complete JSON object
              buffer += chunkStr;

              // For large content, just accumulate until the end
              if (isLargeJson) {
                callback();
                return;
              }

              // Try to parse immediately for smaller content
              try {
                const data = JSON.parse(buffer);
                const transformed = transformFn(data);
                buffer = '';
                this.push(JSON.stringify(transformed));
                callback();
              } catch (_e) {
                // Probably incomplete JSON, continue buffering
                callback();
              }
            }
          } catch (err) {
            callback(err instanceof Error ? err : new Error(String(err)));
          }
        },
        flush(callback) {
          try {
            // Process any remaining buffer
            if (buffer.trim()) {
              try {
                const data = JSON.parse(buffer);
                const transformed = transformFn(data);
                this.push(JSON.stringify(transformed));
              } catch (e) {
                if (opts.validate) {
                  callback(e instanceof Error ? e : new Error(String(e)));
                  return;
                }
                // If not validating, just pass through
                this.push(buffer);
              }
            }
            callback();
          } catch (err) {
            callback(err instanceof Error ? err : new Error(String(err)));
          }
        }
      });
    },
    opts
  );
}

/**
 * Options for CSV transformation
 */
export interface CsvTransformOptions extends StreamProcessingOptions {
  /**
   * Delimiter character
   * @default ','
   */
  delimiter?: string;

  /**
   * Whether the CSV has a header row
   * @default true
   */
  hasHeader?: boolean;

  /**
   * Line separator
   * @default '\n'
   */
  lineSeparator?: string;
}

/**
 * Create a CSV transformation middleware
 * @param transformFn Function to transform CSV rows
 * @param options CSV transform options
 * @returns Middleware function
 */
export function createCsvTransformMiddleware(
  transformFn: (row: Record<string, string> | string[]) => Record<string, string> | string[],
  options?: CsvTransformOptions
) {
  const opts = {
    delimiter: ',',
    hasHeader: true,
    lineSeparator: '\n',
    ...options
  };

  return createStreamTransformMiddleware(
    () => {
      let buffer = '';
      let headers: string[] = [];
      let isFirstRow = true;

      return new Transform({
        objectMode: true,
        transform(chunk, _encoding, callback) {
          try {
            buffer += chunk.toString();

            // Process complete lines
            const lines = buffer.split(opts.lineSeparator);
            buffer = lines.pop() || ''; // Last line might be incomplete

            for (const line of lines) {
              if (!line.trim()) continue;

              // Parse the CSV row
              const row = line.split(opts.delimiter);

              if (isFirstRow && opts.hasHeader) {
                // Save headers and don't transform the header row
                headers = row;
                this.push(line + opts.lineSeparator);
                isFirstRow = false;
                continue;
              }

              let transformedRow;

              if (opts.hasHeader) {
                // Convert to object with header keys
                const rowObj: Record<string, string> = {};
                headers.forEach((header, i) => {
                  if (i < row.length) {
                    rowObj[header] = row[i];
                  }
                });

                // Transform the row
                transformedRow = transformFn(rowObj);

                // Convert back to array
                if (Array.isArray(transformedRow)) {
                  // Already an array, use as is
                } else {
                  // Convert object back to array based on headers
                  const rowArray = headers.map(header =>
                    transformedRow[header] !== undefined ? transformedRow[header] : ''
                  );
                  transformedRow = rowArray;
                }
              } else {
                // No headers, just transform the array
                transformedRow = transformFn(row);

                if (!Array.isArray(transformedRow)) {
                  // Convert object to array
                  transformedRow = Object.values(transformedRow);
                }
              }

              // Convert back to CSV line
              const transformedLine = (transformedRow as string[]).join(opts.delimiter);
              this.push(transformedLine + opts.lineSeparator);
            }

            callback();
          } catch (err) {
            callback(err instanceof Error ? err : new Error(String(err)));
          }
        },
        flush(callback) {
          try {
            // Process any remaining buffer
            if (buffer.trim()) {
              const row = buffer.split(opts.delimiter);

              let transformedRow;

              if (opts.hasHeader) {
                // Convert to object with header keys
                const rowObj: Record<string, string> = {};
                headers.forEach((header, i) => {
                  if (i < row.length) {
                    rowObj[header] = row[i];
                  }
                });

                // Transform the row
                transformedRow = transformFn(rowObj);

                // Convert back to array
                if (Array.isArray(transformedRow)) {
                  // Already an array, use as is
                } else {
                  // Convert object back to array based on headers
                  const rowArray = headers.map(header =>
                    transformedRow[header] !== undefined ? transformedRow[header] : ''
                  );
                  transformedRow = rowArray;
                }
              } else {
                // No headers, just transform the array
                transformedRow = transformFn(row);

                if (!Array.isArray(transformedRow)) {
                  // Convert object to array
                  transformedRow = Object.values(transformedRow);
                }
              }

              // Convert back to CSV line
              const transformedLine = (transformedRow as string[]).join(opts.delimiter);
              this.push(transformedLine);
            }

            callback();
          } catch (err) {
            callback(err instanceof Error ? err : new Error(String(err)));
          }
        }
      });
    },
    opts
  );
}

/**
 * Aggregated stream transformation middleware for supporting multiple transform types
 */
export class StreamProcessor {
  private transformers: Array<(req: IncomingMessage) => Transform> = [];
  private options: StreamProcessingOptions;

  /**
   * Create a new stream processor
   * @param options Stream processing options
   */
  constructor(options?: StreamProcessingOptions) {
    this.options = { ...DEFAULT_STREAM_OPTIONS, ...options };
  }

  /**
   * Add a transform stream creator
   * @param createTransformer Function that creates a transform stream
   * @returns This instance for chaining
   */
  addTransformer(createTransformer: (req: IncomingMessage) => Transform): this {
    this.transformers.push(createTransformer);
    return this;
  }

  /**
   * Create middleware that applies all transformers in sequence
   * @returns Middleware function
   */
  createMiddleware() {
    return createStreamTransformMiddleware(
      (req) => {
        // If no transformers, return a simple passthrough
        if (this.transformers.length === 0) {
          return new PassThrough();
        }

        // Apply each transformer in sequence
        let finalTransform: Transform = this.transformers[0](req);

        for (let i = 1; i < this.transformers.length; i++) {
          const nextTransform = this.transformers[i](req);
          finalTransform = finalTransform.pipe(nextTransform) as Transform;
        }

        return finalTransform;
      },
      this.options
    );
  }
}

/**
 * Create a text processing middleware
 * @param processFunction Function to process text data
 * @param options Stream options
 * @returns Middleware function
 */
export function createTextProcessingMiddleware(
  processFunction: (text: string) => string,
  options?: StreamProcessingOptions
) {
  return createStreamTransformMiddleware(
    () => {
      let buffer = '';
      const chunkSize = options?.chunkSize || DEFAULT_STREAM_OPTIONS.chunkSize;

      return new Transform({
        transform(chunk, _encoding, callback) {
          try {
            buffer += chunk.toString();

            // Process in chunks to avoid excessive memory usage
            while (buffer.length > chunkSize) {
              const processChunk = buffer.slice(0, chunkSize);
              buffer = buffer.slice(chunkSize);

              const processed = processFunction(processChunk);
              this.push(processed);
            }

            callback();
          } catch (err) {
            callback(err instanceof Error ? err : new Error(String(err)));
          }
        },
        flush(callback) {
          try {
            if (buffer.length > 0) {
              const processed = processFunction(buffer);
              this.push(processed);
            }
            callback();
          } catch (err) {
            callback(err instanceof Error ? err : new Error(String(err)));
          }
        }
      });
    },
    options
  );
}

// Default timeout for stream processing (5 seconds)
const _DEFAULT_TIMEOUT = 5000;

/**
 * Middleware that allows transforming the request or response body through a stream pipeline
 *
 * @param {Object} options - Options for configuring the transformation
 * @param {Transform|Transform[]} options.transformers - One or more transform streams to process the body
 * @param {boolean} options.passThrough - Whether to pass the original stream through untransformed
 * @param {number} options.timeout - Timeout in milliseconds for the stream processing (default: 5000ms)
 * @param {boolean} options.useOptimized - Whether to use optimized transform streams with buffer pooling
 * @returns {Function} Middleware function
 */
export function streamTransform(options: any = {}) {
  // Default options
  const {
    transformers = [],
    useOptimized = true,
    passThrough = false,
    useAdaptiveTimeout = true, // New option for adaptive timeouts
    timeout: staticTimeout = 30000
  } = options;

  return async function streamTransformMiddleware(req: IncomingMessage, res: any, next: (err?: any) => Promise<void>) {
    // Skip if no body or no transformers
    if (!hasBody(req) || transformers.length === 0) {
      return await next();
    }

    try {
      // Create optimized transformers
      const optimizedTransformers = useOptimized
        ? transformers.map((t: any) => createOptimizedTransform(t))
        : transformers;

      // Create original body stream for pass-through if needed
      const originalBody = passThrough ? new PassThrough() : null;
      const transformedBody = new PassThrough();

      // Setup timeout handling
      let timeoutHandler: TimeoutHandler | null = null;

      if (useAdaptiveTimeout) {
        // Create adaptive timeout handler based on content size and type
        const contentLength = Number(req.headers['content-length'] || 0);
        const contentType = req.headers['content-type'] as string || 'application/octet-stream';

        timeoutHandler = globalTimeoutManager.createTimeoutHandler({
          size: contentLength,
          contentType,
          operation: 'streamTransform',
          onTimeout: () => {
            // Cleanup streams on timeout
            if (!transformedBody.destroyed) {
              const error = new Error('Stream processing timed out');
              transformedBody.destroy(error);
            }
          }
        });

        // Start the timeout
        timeoutHandler.start();
      } else {
        // Use static timeout
        const timeoutId = setTimeout(() => {
          const error = new Error('Stream processing timed out');
          if (!transformedBody.destroyed) {
            transformedBody.destroy(error);
          }
        }, staticTimeout);

        // Clear timeout on completion
        transformedBody.on('end', () => {
          clearTimeout(timeoutId);
        });

        transformedBody.on('error', () => {
          clearTimeout(timeoutId);
        });
      }

      // Use proper types for pipeline
      const streamSources: any[] = [req];
      if (passThrough && originalBody) {
        streamSources.push(originalBody);
      }
      streamSources.push(...optimizedTransformers);
      streamSources.push(transformedBody);

      // Run pipeline with proper types
      const pipelinePromise = pipeline(streamSources);

      // Handle progress for adaptive timeouts
      if (useAdaptiveTimeout && timeoutHandler) {
        let processedBytes = 0;
        const progressUpdateThreshold = 1024 * 1024; // 1MB threshold
        let lastProgressUpdate = 0;

        // Track progress and extend timeout as needed
        transformedBody.on('data', (chunk) => {
          processedBytes += chunk.length;

          // Extend timeout every 1MB of data processed
          if (processedBytes - lastProgressUpdate >= progressUpdateThreshold) {
            lastProgressUpdate = processedBytes;
            timeoutHandler.extend(10); // Extend by 10%
          }
        });

        // Record processing time on completion
        transformedBody.on('end', () => {
          const contentLength = Number(req.headers['content-length'] || 0);
          const _contentType = req.headers['content-type'] as string || 'application/octet-stream';

          if (contentLength > 0) {
            // Record processing stats to improve future timeout calculations
            timeoutHandler.clear(true);
          }
        });

        transformedBody.on('error', () => {
          timeoutHandler.clear(false);
        });
      }

      // Store the transformed body for later processing
      (req as any).transformedBody = transformedBody;

      // Store the original body if pass-through is enabled
      if (passThrough && originalBody) {
        (req as any).originalBody = originalBody;
      }

      // Register cleanup on response finish
      res.on('finish', () => {
        if (!transformedBody.destroyed) {
          transformedBody.destroy();
        }

        if (passThrough && originalBody && !originalBody.destroyed) {
          originalBody.destroy();
        }
      });

      // Wait for pipeline to be established (not for completion)
      pipelinePromise.catch((err) => {
        // Handle pipeline errors
        next(err);
      });

      await next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Create a text processing transformer with optimized memory usage
 *
 * @param {Object} options - Options for text processing
 * @param {Function} options.processText - Function to process text data
 * @returns {Transform} A transform stream for processing text
 */
export function createTextProcessor(options: any = {}) {
  return createTextTransformer(options);
}

/**
 * Create a JSON processing transformer with optimized memory usage
 *
 * @param {Object} options - Options for JSON processing
 * @param {Function} options.processJson - Function that processes parsed JSON
 * @param {boolean} options.streamArrayItems - Process array items incrementally
 * @returns {Transform} A transform stream for processing JSON
 */
export function createJsonProcessor(options: any = {}) {
  return createJsonTransformer(options);
}
