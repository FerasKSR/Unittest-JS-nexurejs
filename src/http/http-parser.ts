/**
 * JavaScript implementation of HTTP parser
 * This serves as a fallback when the native C++ implementation is not available
 */

import { Buffer } from 'node:buffer';
import type { NativeHttpParser, HttpParseResult as NativeHttpParseResult } from '../types/native.js';

/**
 * HTTP parse result
 */
export interface HttpParseResult extends NativeHttpParseResult {}

/**
 * Base HTTP parser interface
 */
export interface IHttpParser {
  parse(buffer: Buffer): HttpParseResult;
  parseHeaders(buffer: Buffer): Record<string, string>;
  parseBody(buffer: Buffer, contentLength: number): Buffer;
  reset(): void;
}

export class JsHttpParser implements IHttpParser {
  /**
   * Parse an HTTP request
   * @param buffer The HTTP request buffer
   * @returns Parsed HTTP request
   * @throws Error if parsing fails
   */
  parse(buffer: Buffer): HttpParseResult {
    // Implementation of parse method
    // This is a basic implementation that should be enhanced
    const str = buffer.toString('utf8');
    const lines = str.split('\r\n');

    // Parse request line
    const requestLine = lines[0].split(' ');
    if (requestLine.length !== 3) {
      throw new Error('Invalid request line');
    }

    const [method, url, version] = requestLine;
    const versionMatch = version.match(/HTTP\/(\d+)\.(\d+)/);
    if (!versionMatch) {
      throw new Error('Invalid HTTP version');
    }

    // Parse headers
    const headers: Record<string, string> = {};
    let i = 1;
    while (i < lines.length && lines[i] !== '') {
      const line = lines[i];
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) {
        throw new Error('Invalid header line');
      }
      const key = line.slice(0, colonIndex).trim().toLowerCase();
      const value = line.slice(colonIndex + 1).trim();
      headers[key] = value;
      i++;
    }

    // Parse body
    let body: Buffer | null = null;
    if (i < lines.length - 1) {
      const bodyStr = lines.slice(i + 1).join('\r\n');
      body = Buffer.from(bodyStr);
    }

    return {
      method,
      url,
      versionMajor: parseInt(versionMatch[1], 10),
      versionMinor: parseInt(versionMatch[2], 10),
      headers,
      body,
      complete: true,
      upgrade: headers.upgrade === 'websocket'
    };
  }

  /**
   * Parse HTTP headers from a buffer
   * @param buffer Buffer containing HTTP headers
   * @returns Parsed headers
   * @throws Error if parsing fails
   */
  parseHeaders(buffer: Buffer): Record<string, string> {
    const str = buffer.toString('utf8');
    const lines = str.split('\r\n');
    const headers: Record<string, string> = {};

    for (let i = 1; i < lines.length && lines[i] !== ''; i++) {
      const line = lines[i];
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) {
        throw new Error('Invalid header line');
      }
      const key = line.slice(0, colonIndex).trim().toLowerCase();
      const value = line.slice(colonIndex + 1).trim();
      headers[key] = value;
    }

    return headers;
  }

  /**
   * Parse HTTP body from a buffer
   * @param buffer Buffer containing HTTP body
   * @param contentLength Expected content length
   * @returns Parsed body
   * @throws Error if parsing fails
   */
  parseBody(buffer: Buffer, contentLength: number): Buffer {
    if (buffer.length < contentLength) {
      throw new Error('Buffer too small for content length');
    }
    return buffer.slice(0, contentLength);
  }

  /**
   * Reset the parser state
   */
  reset(): void {
    // No state to reset in JS implementation
  }
}

/**
 * HTTP Stream Parser for parsing HTTP requests in chunks
 */
export class HttpStreamParser {
  private parser: IHttpParser;
  private buffer = Buffer.alloc(0);
  private headersParsed = false;
  private contentLength = 0;
  private result: HttpParseResult | null = null;

  constructor(parser: IHttpParser = new JsHttpParser()) {
    this.parser = parser;
  }

  /**
   * Write a chunk of data to the parser
   * @param chunk Data chunk
   * @returns Parse result if complete, null if more data needed
   * @throws Error if parsing fails
   */
  write(chunk: Buffer): HttpParseResult | null {
    if (!Buffer.isBuffer(chunk)) {
      throw new Error('Chunk must be a Buffer');
    }

    // Append the new chunk to our buffer
    this.buffer = Buffer.concat([this.buffer, chunk]);

    try {
      // If we haven't parsed headers yet, check if we have a complete header section
      if (!this.headersParsed) {
        const headerEnd = this.buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) {
          // Headers not complete yet
          return null;
        }

        // Parse the headers
        const headerBuffer = this.buffer.slice(0, headerEnd + 4);
        this.result = this.parser.parse(headerBuffer);
        this.headersParsed = true;

        // Get content length
        this.contentLength = 0;
        const contentLengthHeader = this.result.headers['content-length'];
        if (contentLengthHeader) {
          const parsedLength = parseInt(contentLengthHeader, 10);
          if (isNaN(parsedLength) || parsedLength < 0) {
            throw new Error('Invalid content length');
          }
          this.contentLength = parsedLength;
        }

        // Remove headers from buffer
        this.buffer = this.buffer.slice(headerEnd + 4);

        // If no content length or zero content length, we're done
        if (this.contentLength === 0) {
          const finalResult = this.result;
          this.reset();
          return finalResult;
        }
      }

      // If we have headers and enough data for the body, we're done
      if (this.headersParsed && this.result && this.buffer.length >= this.contentLength) {
        // Create the final result with the body
        const finalResult: HttpParseResult = {
          ...this.result,
          body: this.buffer.slice(0, this.contentLength),
          complete: true
        };

        // Remove the processed body from the buffer
        this.buffer = this.buffer.slice(this.contentLength);

        // Reset for the next request
        this.reset();

        return finalResult;
      }

      // Need more data
      return null;
    } catch (error) {
      // Reset state on error
      this.reset();
      throw error;
    }
  }

  /**
   * Reset the parser state
   */
  reset(): void {
    this.parser.reset();
    this.headersParsed = false;
    this.contentLength = 0;
    this.result = null;
    this.buffer = Buffer.alloc(0);
  }

  /**
   * Get the current buffer
   * @returns Current buffer
   */
  getBuffer(): Buffer {
    return Buffer.from(this.buffer);
  }

  /**
   * Get the current parse state
   * @returns Parse state
   */
  getState(): {
    headersParsed: boolean;
    contentLength: number;
    bufferLength: number;
  } {
    return {
      headersParsed: this.headersParsed,
      contentLength: this.contentLength,
      bufferLength: this.buffer.length
    };
  }
}
