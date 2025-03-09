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

    // If we know the content length, use a more efficient approach
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd !== -1) {
      // Parse headers
      const headerBuffer = buffer.slice(0, headerEnd + 4);
      this.parseHeaders(headerBuffer);

      // Parse body if present
      if (headerEnd + 4 < buffer.length) {
        const bodyBuffer = buffer.slice(headerEnd + 4);
        this.body = bodyBuffer;
      }

      return this.buildResult();
    }

    // Fallback to line-by-line parsing
    return this.parseLineByLine(buffer);
  }

  /**
   * Parse an HTTP request buffer line by line
   * @param buffer The HTTP request buffer
   * @returns Parsed HTTP request
   */
  private parseLineByLine(buffer: Buffer): HttpParseResult {
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
      offset = this.parseHeaderLines(lines, offset);
    }

    // Parse body if headers are complete
    if (this.headerComplete && offset < lines.length) {
      this.parseBodyLines(lines, offset);
    }

    return this.buildResult();
  }

  /**
   * Build the parse result object
   * @returns Parse result
   */
  private buildResult(): HttpParseResult {
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
   * Parse HTTP headers from a buffer
   * @param buffer Buffer containing headers
   */
  private parseHeaders(buffer: Buffer): void {
    const headerText = buffer.toString('utf-8');
    const lines = headerText.split('\r\n');

    // Parse request line
    this.parseRequestLine(lines[0]);

    // Parse header lines
    this.parseHeaderLines(lines, 1);
  }

  /**
   * Parse HTTP header lines
   * @param lines Array of header lines
   * @param offset Starting offset in the lines array
   * @returns New offset after parsing headers
   */
  private parseHeaderLines(lines: string[], offset: number): number {
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
   * Parse HTTP body from lines
   * @param lines Array of body lines
   * @param offset Starting offset in the lines array
   */
  private parseBodyLines(lines: string[], offset: number): void {
    // Join remaining lines to form the body
    const bodyText = lines.slice(offset).join('\r\n');

    // Append to existing body
    const bodyBuffer = Buffer.from(bodyText);
    this.body = Buffer.concat([this.body, bodyBuffer]);
  }
}

/**
 * HTTP Stream Parser for parsing HTTP requests in chunks
 */
export class HttpStreamParser {
  private parser = new HttpParser();
  private buffer = Buffer.alloc(0);
  private headersParsed = false;
  private contentLength = 0;
  private result: HttpParseResult | null = null;

  /**
   * Write a chunk of data to the parser
   * @param chunk Data chunk
   * @returns Parse result if complete, null if more data needed
   */
  write(chunk: Buffer): HttpParseResult | null {
    // Append the new chunk to our buffer
    this.buffer = Buffer.concat([this.buffer, chunk]);

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
        this.contentLength = parseInt(contentLengthHeader, 10);
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
  }

  /**
   * Reset the parser state
   */
  reset(): void {
    this.parser.reset();
    this.headersParsed = false;
    this.contentLength = 0;
    this.result = null;
  }

  /**
   * Get the current buffer
   * @returns Current buffer
   */
  getBuffer(): Buffer {
    return this.buffer;
  }

  /**
   * Get the current parse state
   * @returns Parse state
   */
  getState(): { headersParsed: boolean; contentLength: number; bufferLength: number } {
    return {
      headersParsed: this.headersParsed,
      contentLength: this.contentLength,
      bufferLength: this.buffer.length
    };
  }
}
