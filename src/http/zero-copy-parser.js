/**
 * Zero-Copy HTTP Parser
 *
 * A high-performance HTTP parser that minimizes memory allocations.
 */

// HTTP header constants to avoid string allocations
const HEADER_CONTENT_TYPE = 'content-type';
const HEADER_CONTENT_LENGTH = 'content-length';
const HEADER_HOST = 'host';
const HEADER_USER_AGENT = 'user-agent';
const HEADER_ACCEPT = 'accept';
const HEADER_CONNECTION = 'connection';

/**
 * Zero-Copy HTTP Parser
 */
export class ZeroCopyHttpParser {
  constructor() {
    this.reset();
  }

  /**
   * Parse an HTTP request buffer
   * @param {Buffer} buffer HTTP request buffer
   * @returns {Object} Parsed HTTP request
   */
  parse(buffer) {
    // Reset the parser state
    this.reset();

    // Parse the request line
    const requestLineEnd = buffer.indexOf('\r\n');
    if (requestLineEnd === -1) {
      throw new Error('Invalid HTTP request: missing request line');
    }

    const requestLine = buffer.slice(0, requestLineEnd).toString();
    const [method, url, httpVersion] = requestLine.split(' ');

    this.result.method = method;
    this.result.url = url;
    this.result.httpVersion = httpVersion;

    // Parse headers
    let headerStart = requestLineEnd + 2; // Skip \r\n
    let headerEnd = buffer.indexOf('\r\n\r\n', headerStart);

    if (headerEnd === -1) {
      headerEnd = buffer.length;
      this.result.body = null;
    } else {
      // Parse body if present
      const contentLength = this.parseHeaders(buffer.slice(headerStart, headerEnd));

      if (contentLength > 0) {
        const bodyStart = headerEnd + 4; // Skip \r\n\r\n
        this.result.body = buffer.slice(bodyStart, bodyStart + contentLength);
      } else {
        this.result.body = null;
      }
    }

    return this.result;
  }

  /**
   * Parse HTTP headers
   * @param {Buffer} buffer Header buffer
   * @returns {number} Content length
   */
  parseHeaders(buffer) {
    let contentLength = 0;
    let pos = 0;

    while (pos < buffer.length) {
      const lineEnd = buffer.indexOf('\r\n', pos);
      if (lineEnd === -1) break;

      const line = buffer.slice(pos, lineEnd).toString();
      const colonPos = line.indexOf(':');

      if (colonPos !== -1) {
        const name = line.slice(0, colonPos).trim().toLowerCase();
        const value = line.slice(colonPos + 1).trim();

        this.result.headers[name] = value;

        if (name === HEADER_CONTENT_LENGTH) {
          contentLength = parseInt(value, 10);
        }
      }

      pos = lineEnd + 2; // Skip \r\n
    }

    return contentLength;
  }

  /**
   * Reset the parser state
   */
  reset() {
    this.result = {
      method: '',
      url: '',
      httpVersion: '',
      headers: {},
      body: null
    };
  }

  /**
   * Clear the parser state (public alias for reset)
   */
  clear() {
    this.reset();
  }
}
