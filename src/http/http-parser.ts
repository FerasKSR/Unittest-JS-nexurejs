/**
 * JavaScript implementation of HTTP parser
 * This serves as a fallback when the native C++ implementation is not available
 */

import { Buffer } from 'node:buffer';
import { HTTP_CONSTANTS, HTTP_LIMITS } from './constants.js';
import { ZeroCopyHttpParser, parseHttpRequest, ZeroCopyResult } from '../types/index.js';

/**
 * HTTP parse result
 */
export interface HttpParseResult {
  method: string;
  url: string;
  versionMajor: number;
  versionMinor: number;
  headers: Record<string, string>;
  body: Buffer | null;
  complete: boolean;
  upgrade: boolean;
}

/**
 * Base HTTP parser interface
 */
export interface IHttpParser {
  parse(_buffer: Buffer): HttpParseResult;
  parseHeaders(_buffer: Buffer): Record<string, string>;
  parseBody(_buffer: Buffer, _contentLength: number): Buffer;
  reset(): void;
}

/**
 * JavaScript implementation of HTTP parser
 * This serves as a fallback when the native C++ implementation is not available
 */
export class JsHttpParser implements IHttpParser {
  /**
   * Parse an HTTP request
   * @param buffer The HTTP request buffer
   * @returns Parsed HTTP request
   * @throws Error if parsing fails
   */
  parse(buffer: Buffer): HttpParseResult {
    // Try zero-copy parser first
    try {
      const zeroCopyResult = parseHttpRequest(buffer);
      return this.convertZeroCopyResult(zeroCopyResult);
    } catch (_error) {
      // Fall back to basic implementation if zero-copy fails
      return this.parseBasic(buffer);
    }
  }

  /**
   * Convert zero-copy result to standard HttpParseResult
   */
  private convertZeroCopyResult(result: ZeroCopyResult): HttpParseResult {
    // Extract version from httpVersion string (HTTP/1.1)
    let versionMajor = 1;
    let versionMinor = 1;

    if (result.httpVersion) {
      const versionMatch = result.httpVersion.match(/HTTP\/(\d+)\.(\d+)/i);
      if (versionMatch && versionMatch[1] && versionMatch[2]) {
        versionMajor = parseInt(versionMatch[1], 10);
        versionMinor = parseInt(versionMatch[2], 10);
      }
    }

    return {
      method: result.method,
      url: result.url,
      versionMajor,
      versionMinor,
      headers: this.convertHeaders(result.headers),
      body: result.body,
      complete: result.bodyComplete ?? true,
      upgrade: result.headers['upgrade'] === 'websocket'
    };
  }

  /**
   * Convert HeadersInit to Record<string, string>
   */
  private convertHeaders(
    headers: Record<string, string | string[] | undefined>
  ): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (value !== undefined) {
        result[key] = Array.isArray(value) ? value[0]! : value;
      }
    }
    return result;
  }

  /**
   * Basic implementation for parsing HTTP request
   */
  private parseBasic(buffer: Buffer): HttpParseResult {
    const str = buffer.toString('utf8');
    const lines = str.split(HTTP_CONSTANTS.CRLF.toString());

    // Parse request line
    const requestLine = lines[0]!.split(HTTP_CONSTANTS.SPACE.toString());
    if (requestLine.length !== 3) {
      throw new Error('Invalid request line');
    }

    const [method, url, version] = requestLine;
    const versionMatch = version!.match(/HTTP\/(\d+)\.(\d+)/);
    if (!versionMatch) {
      throw new Error('Invalid HTTP version');
    }

    // Parse headers
    const headers: Record<string, string> = {};
    let i = 1;
    while (i < lines.length && lines[i] !== '') {
      const line = lines[i];
      const colonIndex = line!.indexOf(HTTP_CONSTANTS.COLON_SPACE.toString());
      if (colonIndex === -1) {
        throw new Error('Invalid header line');
      }
      const key = line!.slice(0, colonIndex).trim().toLowerCase();
      const value = line!.slice(colonIndex + 2).trim();
      headers[key] = value;
      i++;
    }

    // Parse body
    let body: Buffer | null = null;
    if (i < lines.length - 1) {
      const bodyStr = lines.slice(i + 1).join(HTTP_CONSTANTS.CRLF.toString());
      body = Buffer.from(bodyStr);
    }

    return {
      method: method!,
      url: url!,
      versionMajor: parseInt(versionMatch![1]!, 10),
      versionMinor: parseInt(versionMatch![2]!, 10),
      headers,
      body,
      complete: true,
      upgrade: headers['upgrade'] === 'websocket'
    };
  }

  /**
   * Parse HTTP headers from a buffer
   * @param buffer Buffer containing HTTP headers
   * @returns Parsed headers
   * @throws Error if parsing fails
   */
  parseHeaders(buffer: Buffer): Record<string, string> {
    const parser = ZeroCopyHttpParser.getParser();
    try {
      const result = parser.parse(buffer);
      return this.convertHeaders(result.headers);
    } finally {
      ZeroCopyHttpParser.releaseParser(parser);
    }
  }

  /**
   * Parse HTTP body from a buffer
   * @param buffer Buffer containing HTTP body
   * @param contentLength Expected content length
   * @returns Parsed body
   * @throws Error if parsing fails
   */
  parseBody(buffer: Buffer, contentLength: number): Buffer {
    if (contentLength > HTTP_LIMITS.MAX_HEADER_SIZE) {
      throw new Error('Content length exceeds maximum allowed size');
    }

    return buffer.slice(0, contentLength);
  }

  /**
   * Reset parser state
   */
  reset(): void {
    // No state to reset in this implementation
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
        const headerEnd = this.buffer.indexOf(HTTP_CONSTANTS.DOUBLE_CRLF);
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

      // Check if we have the complete body
      if (this.buffer.length >= this.contentLength) {
        // Parse the body
        const body = this.parser.parseBody(this.buffer, this.contentLength);
        if (this.result) {
          this.result.body = body;
          this.result.complete = true;
        }

        const finalResult = this.result;
        this.reset();
        return finalResult;
      }

      return null;
    } catch (error) {
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
