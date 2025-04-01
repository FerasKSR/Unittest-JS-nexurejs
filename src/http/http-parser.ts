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
 * HTTP parser interface
 */
export interface IHttpParser {
  parse(buffer: Buffer): HttpParseResult;
  parseHeaders(buffer: Buffer): Record<string, string>;
  parseBody(buffer: Buffer, contentLength: number): Buffer;
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
    // Buffer checks are important for security even if TypeScript thinks they're unnecessary
    // @ts-ignore Buffer check is still needed for runtime safety
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty request');
    }

    if (buffer.length > HTTP_LIMITS.MAX_BODY_SIZE) {
      throw new Error('Request too large');
    }

    // Try zero-copy parser first
    try {
      const zeroCopyResult = parseHttpRequest(buffer);
      if (!zeroCopyResult.complete) {
        throw new Error('Incomplete request');
      }
      return this.convertZeroCopyResult(zeroCopyResult);
    } catch (_error) {
      // Fall back to basic implementation if zero-copy fails
      try {
        return this.parseBasic(buffer);
      } catch (basicError) {
        // If both parsing methods fail, throw the error
        throw basicError;
      }
    }
  }

  /**
   * Parse HTTP headers from a buffer
   * @param buffer Buffer containing HTTP headers
   * @returns Parsed headers
   * @throws Error if parsing fails
   */
  parseHeaders(buffer: Buffer): Record<string, string> {
    // Buffer checks are important for security even if TypeScript thinks they're unnecessary
    // @ts-ignore Buffer check is still needed for runtime safety
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty headers');
    }

    if (buffer.length > HTTP_LIMITS.MAX_HEADER_SIZE) {
      throw new Error('Headers too large');
    }

    const parser = ZeroCopyHttpParser.getParser();
    try {
      const result = parser.parse(buffer);
      return this.convertHeaders(result.headers);
    } catch (_error) {
      // Fall back to basic implementation if zero-copy fails
      return this.parseHeadersBasic(buffer);
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
    // Buffer checks are important for security even if TypeScript thinks they're unnecessary
    // @ts-ignore Buffer check is still needed for runtime safety
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty body');
    }

    if (contentLength > HTTP_LIMITS.MAX_BODY_SIZE) {
      throw new Error('Request body too large');
    }

    if (buffer.length < contentLength) {
      throw new Error('Incomplete request body');
    }

    return buffer.slice(0, contentLength);
  }

  /**
   * Reset parser state
   */
  reset(): void {
    // No state to reset in this implementation
  }

  /**
   * Convert zero-copy result to standard format
   * @param result Zero-copy parse result
   * @returns Standard parse result
   */
  private convertZeroCopyResult(result: ZeroCopyResult): HttpParseResult {
    return {
      method: result.method,
      url: result.url,
      versionMajor: result.versionMajor,
      versionMinor: result.versionMinor,
      headers: this.convertHeaders(result.headers),
      body: result.body,
      complete: result.complete,
      upgrade: result.upgrade
    };
  }

  /**
   * Convert headers to standard format
   * @param headers Raw headers
   * @returns Normalized headers
   */
  private convertHeaders(headers: Record<string, string>): Record<string, string> {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      normalized[key.toLowerCase()] = value;
    }
    return normalized;
  }

  /**
   * Basic HTTP request parser implementation
   * @param buffer Request buffer
   * @returns Parsed request
   * @throws Error if parsing fails
   */
  private parseBasic(buffer: Buffer): HttpParseResult {
    const str = buffer.toString('utf8');
    const lines = str.split('\r\n');

    if (lines.length < 1) {
      throw new Error('Invalid HTTP request: empty request');
    }

    // Parse request line
    const requestLine = lines[0].trim();
    if (!requestLine) {
      throw new Error('Invalid HTTP request: empty request line');
    }

    const requestParts = requestLine.split(' ');
    if (requestParts.length !== 3) {
      throw new Error('Invalid HTTP request: malformed request line');
    }

    const [method, url, version] = requestParts;
    if (!method || !url || !version) {
      throw new Error('Invalid HTTP request: missing method, URL, or version');
    }

    // Validate method
    if (!HTTP_CONSTANTS.METHODS.includes(method.toUpperCase())) {
      throw new Error('Invalid HTTP request: unsupported method');
    }

    // Parse version
    const versionMatch = version.match(/^HTTP\/(\d+)\.(\d+)$/i);
    if (!versionMatch) {
      throw new Error('Invalid HTTP request: malformed HTTP version');
    }

    const versionMajor = parseInt(versionMatch[1], 10);
    const versionMinor = parseInt(versionMatch[2], 10);

    if (versionMajor < 1 || versionMajor > 2) {
      throw new Error('Invalid HTTP request: unsupported HTTP version');
    }

    // Find the index where headers end
    let headersEndIndex = 1;
    while (headersEndIndex < lines.length && lines[headersEndIndex].trim() !== '') {
      headersEndIndex++;
    }

    // Parse headers from line 1 to headersEndIndex
    const headers = this.parseHeadersFromLines(lines.slice(1, headersEndIndex));

    // Parse body
    let body: Buffer | null = null;
    if (headersEndIndex < lines.length - 1) {
      const bodyContent = lines.slice(headersEndIndex + 1).join('\r\n');
      body = Buffer.from(bodyContent);

      if (body.length > HTTP_LIMITS.MAX_BODY_SIZE) {
        throw new Error('Invalid HTTP request: body too large');
      }
    }

    return {
      method,
      url,
      versionMajor,
      versionMinor,
      headers,
      body,
      complete: true,
      upgrade: false
    };
  }

  /**
   * Parse HTTP headers from string lines
   * @param headerLines Array of header lines
   * @returns Parsed headers
   * @throws Error if parsing fails
   */
  private parseHeadersFromLines(headerLines: string[]): Record<string, string> {
    const headers: Record<string, string> = {};
    let headerCount = 0;

    for (const line of headerLines) {
      const trimmedLine = line.trim();
      if (trimmedLine === '') continue;

      if (headerCount >= HTTP_LIMITS.MAX_HEADERS) {
        throw new Error('Invalid HTTP request: too many headers');
      }

      const colonIndex = trimmedLine.indexOf(':');
      if (colonIndex === -1) {
        throw new Error('Invalid HTTP request: malformed header');
      }

      const key = trimmedLine.slice(0, colonIndex).trim().toLowerCase();
      const value = trimmedLine.slice(colonIndex + 1).trim();

      if (!key || !value) {
        throw new Error('Invalid HTTP request: empty header name or value');
      }

      if (key.length > HTTP_LIMITS.MAX_HEADER_NAME_LENGTH) {
        throw new Error('Invalid HTTP request: header name too long');
      }

      if (value.length > HTTP_LIMITS.MAX_HEADER_VALUE_LENGTH) {
        throw new Error('Invalid HTTP request: header value too long');
      }

      headers[key] = value;
      headerCount++;
    }

    return headers;
  }

  /**
   * Basic HTTP headers parser implementation
   * @param buffer Headers buffer
   * @returns Parsed headers
   * @throws Error if parsing fails
   */
  private parseHeadersBasic(buffer: Buffer): Record<string, string> {
    const str = buffer.toString('utf8');
    const lines = str.split('\r\n');
    return this.parseHeadersFromLines(lines);
  }
}

/**
 * HTTP stream parser for handling streaming requests
 */
export class HttpStreamParser {
  private buffer: Buffer;
  private parser: JsHttpParser;
  private state: 'headers' | 'body';
  private contentLength: number;
  private bodyBytesRead: number;

  constructor() {
    this.buffer = Buffer.alloc(0);
    this.parser = new JsHttpParser();
    this.state = 'headers';
    this.contentLength = 0;
    this.bodyBytesRead = 0;
  }

  /**
   * Write data to the parser
   * @param chunk Data chunk
   * @returns Parse result if complete, null if more data needed
   */
  write(chunk: Buffer): HttpParseResult | null {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    if (this.state === 'headers') {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) {
        return null; // Need more data
      }

      const headers = this.parser.parseHeaders(this.buffer.slice(0, headerEnd));
      this.contentLength = parseInt(headers['content-length'] || '0', 10);
      this.state = 'body';
      this.buffer = this.buffer.slice(headerEnd + 4);
    }

    // Process body data
    this.bodyBytesRead += this.buffer.length;
    if (this.bodyBytesRead >= this.contentLength) {
      const result = this.parser.parse(this.buffer);
      this.reset();
      return result;
    }

    return null;
  }

  /**
   * Reset parser state
   */
  reset(): void {
    this.buffer = Buffer.alloc(0);
    this.state = 'headers';
    this.contentLength = 0;
    this.bodyBytesRead = 0;
    this.parser.reset();
  }
}
