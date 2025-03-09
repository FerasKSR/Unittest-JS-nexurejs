/**
 * Zero-Copy HTTP Parser
 *
 * This implementation provides a high-performance HTTP parser that minimizes memory allocations
 * and data copying during request processing. It's designed to work directly with raw Buffer
 * data from sockets for maximum performance.
 */

import { Buffer } from 'node:buffer';

// Define custom HeadersInit type as it's not exported from node:http
type HeadersInit = Record<string, string | string[] | undefined>;

// Define constants for common header names to avoid string allocations
const H_CONTENT_LENGTH = Buffer.from('content-length');
const H_CONTENT_TYPE = Buffer.from('content-type');
const H_CONNECTION = Buffer.from('connection');
const H_TRANSFER_ENCODING = Buffer.from('transfer-encoding');
const H_HOST = Buffer.from('host');
const H_ACCEPT = Buffer.from('accept');
const H_USER_AGENT = Buffer.from('user-agent');

// Common HTTP methods as buffers
const M_GET = Buffer.from('GET');
const M_POST = Buffer.from('POST');
const M_PUT = Buffer.from('PUT');
const M_DELETE = Buffer.from('DELETE');
const M_HEAD = Buffer.from('HEAD');
const M_OPTIONS = Buffer.from('OPTIONS');
const M_PATCH = Buffer.from('PATCH');

// Define separator constants
const CRLF = Buffer.from('\r\n');
const COLON_SPACE = Buffer.from(': ');

// String buffers pool for reuse
const stringBufferPool = new Map<string, Buffer>();

// Get a buffer from the pool or create a new one
function getBufferForString(str: string): Buffer {
  let buffer = stringBufferPool.get(str);
  if (!buffer) {
    buffer = Buffer.from(str);
    if (stringBufferPool.size < 1000) { // Limit pool size
      stringBufferPool.set(str, buffer);
    }
  }
  return buffer;
}

// Parser result interface
export interface HttpParseResult {
  method: string;
  url: string;
  httpVersion: string;
  headers: HeadersInit;
  headersComplete: boolean;
  body: Buffer | null;
  bodyComplete: boolean;
  bytesRead: number;
}

/**
 * HTTP Parser class designed for minimal allocations
 */
export class ZeroCopyHttpParser {
  private static parserPool: ZeroCopyHttpParser[] = [];

  // Parser state
  private state: 'REQUEST_LINE' | 'HEADERS' | 'BODY' = 'REQUEST_LINE';
  private buffer: Buffer | null = null;
  private position = 0;
  private bodyStart = 0;
  private contentLength = 0;
  private chunked = false;

  // Parse result
  private result: HttpParseResult = {
    method: '',
    url: '',
    httpVersion: '',
    headers: {},
    headersComplete: false,
    body: null,
    bodyComplete: false,
    bytesRead: 0
  };

  // Get a parser from the pool or create a new one
  static getParser(): ZeroCopyHttpParser {
    if (this.parserPool.length > 0) {
      const parser = this.parserPool.pop()!;
      parser.reset();
      return parser;
    }
    return new ZeroCopyHttpParser();
  }

  // Return parser to the pool
  static releaseParser(parser: ZeroCopyHttpParser): void {
    if (this.parserPool.length < 1000) { // Limit pool size
      this.parserPool.push(parser);
    }
  }

  // Reset parser state
  private reset(): void {
    this.state = 'REQUEST_LINE';
    this.buffer = null;
    this.position = 0;
    this.bodyStart = 0;
    this.contentLength = 0;
    this.chunked = false;

    this.result.method = '';
    this.result.url = '';
    this.result.httpVersion = '';
    this.result.headers = {};
    this.result.headersComplete = false;
    this.result.body = null;
    this.result.bodyComplete = false;
    this.result.bytesRead = 0;
  }

  // Parse HTTP data
  parse(data: Buffer): HttpParseResult {
    this.buffer = data;
    this.position = 0;

    // Process request line if we're just starting
    if (this.state === 'REQUEST_LINE') {
      this.parseRequestLine();
    }

    // Process headers if we're on headers or just finished request line
    if (this.state === 'HEADERS') {
      this.parseHeaders();
    }

    // Process body if headers are complete
    if (this.state === 'BODY' && this.result.headersComplete) {
      this.parseBody();
    }

    this.result.bytesRead = this.position;
    return this.result;
  }

  // Parse HTTP request line (GET /path HTTP/1.1)
  private parseRequestLine(): void {
    if (!this.buffer) return;

    const lineEnd = this.buffer.indexOf(CRLF, this.position);
    if (lineEnd === -1) return; // Incomplete line

    const line = this.buffer.subarray(this.position, lineEnd);
    this.position = lineEnd + 2; // Skip CRLF

    // Split the line into method, url, and version
    const firstSpace = line.indexOf(' ');
    const lastSpace = line.lastIndexOf(' ');

    if (firstSpace === -1 || lastSpace === -1 || firstSpace === lastSpace) return; // Invalid request line

    // Extract method using buffer comparison to avoid string allocations
    const method = line.subarray(0, firstSpace);
    if (M_GET.equals(method)) {
      this.result.method = 'GET';
    } else if (M_POST.equals(method)) {
      this.result.method = 'POST';
    } else if (M_PUT.equals(method)) {
      this.result.method = 'PUT';
    } else if (M_DELETE.equals(method)) {
      this.result.method = 'DELETE';
    } else if (M_HEAD.equals(method)) {
      this.result.method = 'HEAD';
    } else if (M_OPTIONS.equals(method)) {
      this.result.method = 'OPTIONS';
    } else if (M_PATCH.equals(method)) {
      this.result.method = 'PATCH';
    } else {
      this.result.method = method.toString();
    }

    // Extract URL and HTTP version
    this.result.url = line.subarray(firstSpace + 1, lastSpace).toString();
    this.result.httpVersion = line.subarray(lastSpace + 1).toString();

    // Update state to HEADERS
    this.state = 'HEADERS';
  }

  // Parse HTTP headers
  private parseHeaders(): void {
    if (!this.buffer) return;

    let lineEnd = this.buffer.indexOf(CRLF, this.position);

    // Process each header line
    while (lineEnd !== -1) {
      // Empty line (CRLF CRLF) marks the end of headers
      if (lineEnd === this.position) {
        this.position += 2; // Skip the empty CRLF
        this.bodyStart = this.position;
        this.result.headersComplete = true;
        this.state = 'BODY';

        // Check for content length and chunked transfer encoding
        const contentLengthValue = this.result.headers['content-length'];
        if (contentLengthValue) {
          this.contentLength = parseInt(contentLengthValue as string, 10);
        }

        const transferEncoding = this.result.headers['transfer-encoding'];
        if (transferEncoding === 'chunked') {
          this.chunked = true;
        }

        break;
      }

      // Parse the header line
      const line = this.buffer.subarray(this.position, lineEnd);
      this.position = lineEnd + 2; // Skip CRLF

      const colonPos = line.indexOf(COLON_SPACE);
      if (colonPos === -1) continue; // Invalid header

      const headerName = line.subarray(0, colonPos).toString().toLowerCase();
      const headerValue = line.subarray(colonPos + 2).toString().trim();

      // Store in headers object
      this.result.headers[headerName] = headerValue;

      // Get next line position
      lineEnd = this.buffer.indexOf(CRLF, this.position);
    }
  }

  // Parse HTTP body
  private parseBody(): void {
    if (!this.buffer || this.bodyStart === 0) return;

    if (this.chunked) {
      // Chunked encoding is complex, would need a more sophisticated parser
      // For now, just return the remaining buffer
      this.result.body = this.buffer.subarray(this.bodyStart);
      this.result.bodyComplete = false; // Can't determine if complete
    } else if (this.contentLength > 0) {
      // Fixed content length
      const bodyEnd = this.bodyStart + this.contentLength;

      if (bodyEnd <= this.buffer.length) {
        // Complete body
        this.result.body = this.buffer.subarray(this.bodyStart, bodyEnd);
        this.result.bodyComplete = true;
        this.position = bodyEnd;
      } else {
        // Incomplete body
        this.result.body = this.buffer.subarray(this.bodyStart);
        this.result.bodyComplete = false;
      }
    } else {
      // No content length specified
      this.result.body = this.buffer.subarray(this.bodyStart);
      this.result.bodyComplete = true;
    }
  }
}

// Factory function to parse HTTP requests
export function parseHttpRequest(data: Buffer): HttpParseResult {
  const parser = ZeroCopyHttpParser.getParser();
  const result = parser.parse(data);
  ZeroCopyHttpParser.releaseParser(parser);
  return result;
}
