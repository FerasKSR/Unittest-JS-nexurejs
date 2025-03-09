/**
 * Request object pool to reduce garbage collection overhead
 */

import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';

/**
 * Request pool options
 */
export interface RequestPoolOptions {
  /**
   * Maximum size of the pool
   * @default 1000
   */
  maxSize?: number;

  /**
   * Whether to enable the pool
   * @default true
   */
  enabled?: boolean;
}

/**
 * Request object pool
 *
 * This class maintains a pool of IncomingMessage objects to reduce
 * garbage collection overhead by reusing objects instead of creating
 * new ones for each request.
 */
export class RequestPool {
  private pool: IncomingMessage[] = [];
  private maxSize: number;
  private enabled: boolean;
  private socket: Socket;

  /**
   * Create a new request pool
   * @param options Request pool options
   */
  constructor(options: RequestPoolOptions = {}) {
    this.maxSize = options.maxSize || 1000;
    this.enabled = options.enabled !== false;
    this.socket = new Socket();
  }

  /**
   * Acquire a request object from the pool
   */
  acquire(): IncomingMessage {
    if (!this.enabled || this.pool.length === 0) {
      return new IncomingMessage(this.socket);
    }

    return this.pool.pop()!;
  }

  /**
   * Release a request object back to the pool
   * @param req The request object to release
   */
  release(req: IncomingMessage): void {
    if (!this.enabled || this.pool.length >= this.maxSize) {
      return;
    }

    // Clean up request object
    req.headers = {};
    req.url = '';
    req.method = '';
    req.httpVersion = '1.1';
    req.httpVersionMajor = 1;
    req.httpVersionMinor = 1;
    req.trailers = {};
    req.complete = false;

    // Reset internal properties
    (req as any)._readableState.buffer.clear();
    (req as any)._readableState.length = 0;
    (req as any)._readableState.ended = false;
    (req as any)._readableState.endEmitted = false;

    // Add back to pool
    this.pool.push(req);
  }

  /**
   * Clear the pool
   */
  clear(): void {
    this.pool = [];
  }

  /**
   * Get the current size of the pool
   */
  size(): number {
    return this.pool.length;
  }
}

/**
 * Response object pool
 *
 * This class maintains a pool of ServerResponse objects to reduce
 * garbage collection overhead by reusing objects instead of creating
 * new ones for each response.
 */
export class ResponsePool {
  private pool: ServerResponse[] = [];
  private maxSize: number;
  private enabled: boolean;

  /**
   * Create a new response pool
   * @param options Response pool options
   */
  constructor(options: RequestPoolOptions = {}) {
    this.maxSize = options.maxSize || 1000;
    this.enabled = options.enabled !== false;
  }

  /**
   * Acquire a response object from the pool
   * @param req The request object to associate with the response
   */
  acquire(req: IncomingMessage): ServerResponse {
    if (!this.enabled || this.pool.length === 0) {
      return new ServerResponse(req);
    }

    const res = this.pool.pop()!;

    // Update the request reference
    (res as any)._req = req;

    return res;
  }

  /**
   * Release a response object back to the pool
   * @param res The response object to release
   */
  release(res: ServerResponse): void {
    if (!this.enabled || this.pool.length >= this.maxSize) {
      return;
    }

    // Clean up response object
    res.statusCode = 200;
    res.statusMessage = '';

    // Clear headers
    for (const name of res.getHeaderNames()) {
      res.removeHeader(name);
    }

    // Reset internal properties
    (res as any)._sent100 = false;
    (res as any)._expect_continue = false;
    (res as any)._contentLength = null;
    (res as any)._hasBody = true;
    (res as any)._trailer = '';

    // Add back to pool
    this.pool.push(res);
  }

  /**
   * Clear the pool
   */
  clear(): void {
    this.pool = [];
  }

  /**
   * Get the current size of the pool
   */
  size(): number {
    return this.pool.length;
  }
}
