/**
 * Stream Optimizer
 *
 * Utilities for optimizing stream processing through buffer reuse,
 * efficient chunk handling, and adaptive processing strategies.
 */

import { Transform, TransformCallback, TransformOptions } from 'node:stream';
import { BufferPool, globalPool } from './buffer-pool';

// Custom transform option types separate from the base TransformOptions
interface OptimizedBufferOptions {
  bufferPool?: BufferPool;
}

/**
 * Creates a transform stream that optimizes memory usage by reusing buffers
 */
class OptimizedTransform extends Transform {
  bufferPool: BufferPool;
  activeBuffers: Set<Buffer>;

  /**
   * Create a new optimized transform stream
   */
  constructor(options: TransformOptions & OptimizedBufferOptions = {}) {
    // Extract our custom options
    const { bufferPool, ...streamOptions } = options;

    // Call base class constructor with standard options
    super(streamOptions);

    this.bufferPool = bufferPool || globalPool;
    this.activeBuffers = new Set();
  }

  /**
   * Get an optimized buffer from the pool
   * @param size Minimum size needed
   * @returns A buffer from the pool
   */
  getBuffer(size: number): Buffer {
    const buffer = this.bufferPool.acquire(size);
    this.activeBuffers.add(buffer);
    return buffer;
  }

  /**
   * Release a buffer back to the pool
   * @param buffer Buffer to release
   */
  releaseBuffer(buffer: Buffer): void {
    if (this.activeBuffers.has(buffer)) {
      this.activeBuffers.delete(buffer);
      this.bufferPool.release(buffer);
    }
  }

  /**
   * Default transform implementation
   * @param chunk The chunk to process
   * @param encoding The encoding of the chunk
   * @param callback Callback when processing is complete
   */
  override _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback): void {
    // Default implementation just passes through
    this.push(chunk);
    callback();
  }

  /**
   * Clean up any remaining buffers
   * @param callback Callback when flush is complete
   */
  override _flush(callback: TransformCallback): void {
    // Release any remaining buffers
    for (const buffer of this.activeBuffers) {
      this.bufferPool.release(buffer);
    }
    this.activeBuffers.clear();
    callback();
  }
}

// Options for creating an optimized transform with custom handlers
interface OptimizedTransformCreateOptions extends TransformOptions, OptimizedBufferOptions {
  customTransform?: (
    transform: OptimizedTransform,
    chunk: any,
    encoding: BufferEncoding,
    callback: TransformCallback
  ) => void;
  customFlush?: (transform: OptimizedTransform, callback: TransformCallback) => void;
}

/**
 * Create a new optimized transform stream
 * @param options Transform options
 * @returns An optimized transform stream
 */
function createOptimizedTransform(
  options: OptimizedTransformCreateOptions = {}
): OptimizedTransform {
  const { customTransform, customFlush, ...standardOptions } = options;

  const transform = new OptimizedTransform(standardOptions);

  // Override transform method if custom function provided
  if (typeof customTransform === 'function') {
    transform._transform = function (
      chunk: any,
      encoding: BufferEncoding,
      callback: TransformCallback
    ): void {
      try {
        customTransform(this, chunk, encoding, callback);
      } catch (err) {
        callback(err instanceof Error ? err : new Error(String(err)));
      }
    };
  }

  // Override flush method if custom function provided
  if (typeof customFlush === 'function') {
    transform._flush = function (callback: TransformCallback): void {
      try {
        customFlush(this, callback);
      } catch (err) {
        callback(err instanceof Error ? err : new Error(String(err)));
      }
    };
  }

  return transform;
}

interface TextTransformerOptions extends OptimizedBufferOptions, TransformOptions {
  processText?: (text: string) => string | Buffer | undefined;
}

/**
 * Create a text processing transform with buffer reuse
 * @param options Configuration options
 * @returns Optimized transform stream
 */
function createTextTransformer(options: TextTransformerOptions = {}): OptimizedTransform {
  let textBuffer = '';
  const { processText, ...transformOptions } = options;

  return createOptimizedTransform({
    ...transformOptions,
    customTransform: (transform, chunk, encoding, callback) => {
      try {
        // Convert chunk to string and add to buffer
        textBuffer += chunk.toString();

        // Process text if we have a handler
        if (typeof processText === 'function') {
          const result = processText(textBuffer);
          textBuffer = ''; // Clear after processing

          if (result) {
            if (Buffer.isBuffer(result)) {
              transform.push(result);
            } else {
              transform.push(Buffer.from(result));
            }
          }
        } else {
          // If no handler, just pass through
          transform.push(chunk);
        }

        callback();
      } catch (err) {
        callback(err instanceof Error ? err : new Error(String(err)));
      }
    },

    customFlush: (transform, callback) => {
      // Process any remaining text
      if (textBuffer && typeof processText === 'function') {
        try {
          const result = processText(textBuffer);
          if (result) {
            if (Buffer.isBuffer(result)) {
              transform.push(result);
            } else {
              transform.push(Buffer.from(result));
            }
          }
        } catch (err) {
          return callback(err instanceof Error ? err : new Error(String(err)));
        }
      }

      callback();
    }
  });
}

interface JsonTransformerOptions extends OptimizedBufferOptions, TransformOptions {
  processJson?: (json: any) => any;
  processError?: (err: Error, rawData?: string) => void;
  streamArrayItems?: boolean;
}

/**
 * Create a JSON processing transform with optimized memory usage
 * @param options Configuration options
 * @returns Optimized transform stream
 */
function createJsonTransformer(options: JsonTransformerOptions = {}): OptimizedTransform {
  let jsonBuffer = '';
  let isFirstChunk = true;
  const { processJson, processError, streamArrayItems, ...transformOptions } = options;

  return createOptimizedTransform({
    objectMode: true,
    ...transformOptions,

    customTransform: (transform, chunk, encoding, callback) => {
      try {
        const text = chunk.toString();
        jsonBuffer += text;

        // Detect if this is a JSON array stream and we can process incrementally
        if (isFirstChunk && streamArrayItems) {
          isFirstChunk = false;
          if (text.trimStart().startsWith('[')) {
            // Process as streaming array
            processStreamingArray(transform, text);
            callback();
            return;
          }
        }

        // Not streaming or not an array, try to parse the full buffer
        tryParseCompleteJson(transform);
        callback();
      } catch (err) {
        callback(err instanceof Error ? err : new Error(String(err)));
      }
    },

    customFlush: (transform, callback) => {
      // Process any remaining JSON data
      if (jsonBuffer.trim()) {
        try {
          const data = JSON.parse(jsonBuffer);

          if (typeof processJson === 'function') {
            const result = processJson(data);
            if (result !== undefined) {
              transform.push(result);
            }
          } else {
            transform.push(data);
          }
        } catch (err) {
          if (processError && err instanceof Error) {
            processError(err, jsonBuffer);
          }
          return callback(err instanceof Error ? err : new Error(String(err)));
        }
      }

      callback();
    }
  });

  // Helper function to process a complete JSON buffer
  function tryParseCompleteJson(transform: OptimizedTransform): void {
    try {
      // Attempt to parse the JSON
      const data = JSON.parse(jsonBuffer);
      jsonBuffer = ''; // Clear buffer after successful parse

      // Process the JSON data if we have a handler
      if (typeof processJson === 'function') {
        const result = processJson(data);
        if (result !== undefined) {
          transform.push(result);
        }
      } else {
        transform.push(data);
      }
    } catch (_syntaxError) {
      // Not complete JSON yet, wait for more data
    }
  }

  // Helper function to process a streaming JSON array
  function processStreamingArray(transform: OptimizedTransform, text: string): void {
    // We'll stream process this array
    jsonBuffer = '';

    // Set up streaming JSON parser
    let openBrackets = 0;
    let currentItem = '';
    let inString = false;
    let escapeNext = false;

    for (const char of text) {
      if (escapeNext) {
        escapeNext = false;
        currentItem += char;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        currentItem += char;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        currentItem += char;
        continue;
      }

      if (!inString) {
        if (char === '[') {
          openBrackets++;
          if (openBrackets === 1) {
            // Start of array, don't add to currentItem
            continue;
          }
        } else if (char === ']') {
          openBrackets--;
          if (openBrackets === 0) {
            // End of array, process last item
            processArrayItem(transform, currentItem);
            continue;
          }
        } else if (char === ',' && openBrackets === 1) {
          // End of array item, process it
          processArrayItem(transform, currentItem);
          currentItem = '';
          continue;
        }
      }

      currentItem += char;
    }

    // Store any leftover data
    jsonBuffer = currentItem;
  }

  // Helper function to process a single array item
  function processArrayItem(transform: OptimizedTransform, item: string): void {
    if (item.trim()) {
      try {
        const parsedItem = JSON.parse(item);
        if (typeof processJson === 'function') {
          const result = processJson(parsedItem);
          if (result !== undefined) {
            transform.push(result);
          }
        } else {
          transform.push(parsedItem);
        }
      } catch (err) {
        if (processError && err instanceof Error) {
          processError(err, item);
        }
      }
    }
  }
}

interface BufferedTransformerOptions extends OptimizedBufferOptions, TransformOptions {
  chunkSize?: number;
  processBuffer?: (buffer: Buffer) => Buffer | string | undefined;
}

/**
 * Create a buffer processing transform that accumulates data to a specific size
 * @param options Configuration options
 * @returns Optimized transform stream
 */
function createBufferedTransformer(options: BufferedTransformerOptions = {}): OptimizedTransform {
  const chunkSize = options.chunkSize || 64 * 1024; // Default 64KB chunks
  let buffer: Buffer | null = null;
  let offset = 0;
  const { processBuffer, ...transformOptions } = options;

  // Helper function to process buffer content and push to stream
  function processAndReleaseBuffer(
    transform: OptimizedTransform,
    buf: Buffer,
    length: number
  ): void {
    const validBuffer = buf.slice(0, length);

    if (typeof processBuffer === 'function') {
      const result = processBuffer(validBuffer);
      pushResult(transform, result);
    } else {
      transform.push(validBuffer);
    }

    // Release the buffer
    transform.releaseBuffer(buf);
  }

  // Helper function to push result to the transform stream
  function pushResult(transform: OptimizedTransform, result: Buffer | string | undefined): void {
    if (!result) return;

    if (Buffer.isBuffer(result)) {
      transform.push(result);
    } else {
      transform.push(Buffer.from(result));
    }
  }

  return createOptimizedTransform({
    ...transformOptions,

    customTransform: (transform, chunk, encoding, callback) => {
      try {
        const incomingBuffer = Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.from(chunk, encoding as BufferEncoding);

        // Initialize the buffer if needed
        if (!buffer) {
          buffer = transform.getBuffer(Math.max(chunkSize, incomingBuffer.length));
          offset = 0;
        }

        // If current buffer can't hold the new data, process and flush it
        if (offset + incomingBuffer.length > buffer.length) {
          processAndReleaseBuffer(transform, buffer, offset);

          // Get a new buffer
          buffer = transform.getBuffer(Math.max(chunkSize, incomingBuffer.length));
          offset = 0;
        }

        // Copy new data into the buffer
        incomingBuffer.copy(buffer, offset);
        offset += incomingBuffer.length;

        callback();
      } catch (err) {
        callback(err instanceof Error ? err : new Error(String(err)));
      }
    },

    customFlush: (transform, callback) => {
      // Process any remaining data in the buffer
      if (buffer && offset > 0) {
        try {
          processAndReleaseBuffer(transform, buffer, offset);
        } catch (err) {
          return callback(err instanceof Error ? err : new Error(String(err)));
        }
      }

      callback();
    }
  });
}

// Export the utilities
export {
  OptimizedTransform,
  createOptimizedTransform,
  createTextTransformer,
  createJsonTransformer,
  createBufferedTransformer
};
