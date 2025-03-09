/**
 * CSRF protection middleware
 */

import { IncomingMessage, ServerResponse } from 'node:http';
import { randomBytes, createHmac } from 'node:crypto';
import { MiddlewareHandler } from '../middleware/middleware.js';
import { HttpException } from '../http/http-exception.js';

/**
 * CSRF options
 */
export interface CsrfOptions {
  /**
   * Secret key for CSRF token generation
   * @default Random 32-byte string
   */
  secret?: string;

  /**
   * Cookie name for CSRF token
   * @default '_csrf'
   */
  cookieName?: string;

  /**
   * Header name for CSRF token
   * @default 'x-csrf-token'
   */
  headerName?: string;

  /**
   * Form field name for CSRF token
   * @default '_csrf'
   */
  fieldName?: string;

  /**
   * Cookie options
   */
  cookie?: {
    /**
     * Cookie path
     * @default '/'
     */
    path?: string;

    /**
     * Cookie domain
     */
    domain?: string;

    /**
     * Cookie secure flag
     * @default true
     */
    secure?: boolean;

    /**
     * Cookie HTTP only flag
     * @default true
     */
    httpOnly?: boolean;

    /**
     * Cookie same site policy
     * @default 'strict'
     */
    sameSite?: 'strict' | 'lax' | 'none';

    /**
     * Cookie max age in seconds
     * @default 86400 (1 day)
     */
    maxAge?: number;
  };

  /**
   * Whether to ignore GET, HEAD, OPTIONS requests
   * @default true
   */
  ignoreMethods?: string[];
}

/**
 * CSRF token generator
 */
export class CsrfTokenGenerator {
  private secret: string;

  /**
   * Create a new CSRF token generator
   * @param secret Secret key for CSRF token generation
   */
  constructor(secret?: string) {
    this.secret = secret || randomBytes(32).toString('hex');
  }

  /**
   * Generate a CSRF token
   * @param sessionId Session ID or other unique identifier
   */
  generateToken(sessionId: string): string {
    const timestamp = Date.now().toString();
    const hmac = createHmac('sha256', this.secret);
    hmac.update(`${sessionId}:${timestamp}`);
    const hash = hmac.digest('hex');

    return `${timestamp}:${hash}`;
  }

  /**
   * Verify a CSRF token
   * @param token CSRF token to verify
   * @param sessionId Session ID or other unique identifier
   */
  verifyToken(token: string, sessionId: string): boolean {
    const parts = token.split(':');

    if (parts.length !== 2) {
      return false;
    }

    const [timestamp, hash] = parts;

    // Generate expected hash
    const hmac = createHmac('sha256', this.secret);
    hmac.update(`${sessionId}:${timestamp}`);
    const expectedHash = hmac.digest('hex');

    // Verify hash
    return hash === expectedHash;
  }
}

/**
 * Build a cookie string with the given options
 * @param name Cookie name
 * @param value Cookie value
 * @param options Cookie options
 */
function buildCookieString(name: string, value: string, options: CsrfOptions['cookie'] = {}): string {
  const parts: string[] = [`${name}=${value}`];

  // Add path
  parts.push(`Path=${options.path || '/'}`);

  // Add domain if specified
  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }

  // Add secure flag if enabled
  if (options.secure !== false) {
    parts.push('Secure');
  }

  // Add HTTP only flag if enabled
  if (options.httpOnly !== false) {
    parts.push('HttpOnly');
  }

  // Add same site policy
  parts.push(`SameSite=${options.sameSite || 'strict'}`);

  // Add max age if specified
  if (options.maxAge) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  return parts.join('; ');
}

/**
 * Create CSRF protection middleware
 * @param options CSRF options
 */
export function createCsrfMiddleware(options: CsrfOptions = {}): MiddlewareHandler {
  // Set default options
  const secret = options.secret;
  const cookieName = options.cookieName || '_csrf';
  const headerName = options.headerName || 'x-csrf-token';
  const fieldName = options.fieldName || '_csrf';
  const ignoreMethods = options.ignoreMethods || ['GET', 'HEAD', 'OPTIONS'];

  // Create token generator
  const tokenGenerator = new CsrfTokenGenerator(secret);

  return async (req: IncomingMessage, res: ServerResponse, next: () => Promise<void>) => {
    // Get session ID (or use IP address as fallback)
    const sessionId = (req as any).sessionId || req.socket.remoteAddress || 'unknown';

    // Generate a new token
    const token = tokenGenerator.generateToken(sessionId);

    // Store token in request
    (req as any).csrfToken = token;

    // Set CSRF cookie
    const cookieString = buildCookieString(cookieName, token, options.cookie);
    res.setHeader('Set-Cookie', cookieString);

    // Skip CSRF check for ignored methods
    if (ignoreMethods.includes(req.method || '')) {
      return next();
    }

    // Get token from request
    const requestToken = (req.headers[headerName.toLowerCase()] as string)
      || ((req as any).body && (req as any).body[fieldName]);

    // Verify token
    if (!requestToken || !tokenGenerator.verifyToken(requestToken, sessionId)) {
      throw new HttpException(403, 'CSRF token validation failed');
    }

    await next();
  };
}

/**
 * Create a middleware that adds a CSRF token to the response
 * @param options CSRF options
 */
export function createCsrfTokenMiddleware(options: CsrfOptions = {}): MiddlewareHandler {
  // Set default options
  const headerName = options.headerName || 'x-csrf-token';

  return async (req: IncomingMessage, res: ServerResponse, next: () => Promise<void>) => {
    // Get CSRF token from request
    const token = (req as any).csrfToken;

    if (token) {
      // Set CSRF token header
      res.setHeader(headerName, token);
    }

    await next();
  };
}
