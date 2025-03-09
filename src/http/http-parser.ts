/**
 * JavaScript implementation of HTTP parser
 * This serves as a fallback when the native C++ implementation is not available
 */

export interface HttpParseResult {
  method: string;
  url: string;
  httpVersion: string;
  headers: Record<string, string>;
  body: Buffer | null;
  complete: boolean;
}

export class HttpParser {
  private headerComplete: boolean = false;
  private contentLength: number = 0;
  private method: string = '';
  private url: string = '';
  private httpVersion: string = '';
  private headers: Record<string, string> = {};
  private body: Buffer = Buffer.alloc(0);

  /**
   * Parse an HTTP request buffer
   * @param buffer The HTTP request buffer
   * @returns Parsed HTTP request
   */
  parse(buffer: Buffer): HttpParseResult {
    // Reset state for new parse
    this.reset();

    const data = buffer.toString('utf-8');
    const lines = data.split('\r\n');
    let offset = 0;

    // Parse request line if not already done
    if (!this.method) {
      this.parseRequestLine(lines[offset]);
      offset++;
    }

    // Parse headers if not complete
    if (!this.headerComplete) {
      offset = this.parseHeaders(lines, offset);
    }

    // Parse body if headers are complete
    if (this.headerComplete && offset < lines.length) {
      this.parseBody(lines, offset);
    }

    return {
      method: this.method,
      url: this.url,
      httpVersion: this.httpVersion,
      headers: this.headers,
      body: this.body.length > 0 ? this.body : null,
      complete: this.headerComplete && (this.contentLength === 0 || this.body.length >= this.contentLength)
    };
  }

  /**
   * Reset the parser state
   */
  reset(): void {
    this.headerComplete = false;
    this.contentLength = 0;
    this.method = '';
    this.url = '';
    this.httpVersion = '';
    this.headers = {};
    this.body = Buffer.alloc(0);
  }

  /**
   * Parse the HTTP request line
   * @param line The request line
   */
  private parseRequestLine(line: string): void {
    const parts = line.split(' ');
    if (parts.length < 3) {
      throw new Error('Invalid request line format');
    }

    this.method = parts[0];
    this.url = parts[1];
    this.httpVersion = parts[2].replace('HTTP/', '');
  }

  /**
   * Parse HTTP headers
   * @param lines Array of header lines
   * @param offset Starting offset in the lines array
   * @returns New offset after parsing headers
   */
  private parseHeaders(lines: string[], offset: number): number {
    while (offset < lines.length) {
      const line = lines[offset];

      // Empty line indicates end of headers
      if (line === '') {
        this.headerComplete = true;

        // Get content length if present
        const contentLength = this.headers['content-length'];
        if (contentLength) {
          this.contentLength = parseInt(contentLength, 10);
        }

        return offset + 1;
      }

      // Parse header
      const colonPos = line.indexOf(':');
      if (colonPos !== -1) {
        const name = line.substring(0, colonPos).trim().toLowerCase();
        const value = line.substring(colonPos + 1).trim();
        this.headers[name] = value;
      }

      offset++;
    }

    return offset;
  }

  /**
   * Parse HTTP body
   * @param lines Array of body lines
   * @param offset Starting offset in the lines array
   */
  private parseBody(lines: string[], offset: number): void {
    // Join remaining lines to form the body
    const bodyText = lines.slice(offset).join('\r\n');

    // Append to existing body
    const bodyBuffer = Buffer.from(bodyText);
    this.body = Buffer.concat([this.body, bodyBuffer]);
  }
}
