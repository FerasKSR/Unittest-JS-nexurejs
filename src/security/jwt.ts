/**
 * JWT authentication middleware
 */

import { IncomingMessage, ServerResponse } from 'node:http';
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { MiddlewareHandler, HttpException } from '../types/index.js';

/**
 * JWT options
 */
export interface JwtOptions {
  /**
   * Secret key for JWT signing
   */
  secret: string;

  /**
   * JWT algorithm
   * @default 'HS256'
   */
  algorithm?: 'HS256' | 'HS384' | 'HS512';

  /**
   * Token expiration time in seconds
   * @default 3600 (1 hour)
   */
  expiresIn?: number;

  /**
   * Token issuer
   */
  issuer?: string;

  /**
   * Token audience
   */
  audience?: string;

  /**
   * Extract token from request
   * @default Bearer token from Authorization header
   */
  extractToken?: (req: IncomingMessage) => string | null;
}

/**
 * JWT payload
 */
export interface JwtPayload {
  /**
   * Subject (usually user ID)
   */
  sub?: string;

  /**
   * Issuer
   */
  iss?: string;

  /**
   * Audience
   */
  aud?: string;

  /**
   * Expiration time (in seconds since Unix epoch)
   */
  exp?: number;

  /**
   * Issued at (in seconds since Unix epoch)
   */
  iat?: number;

  /**
   * JWT ID
   */
  jti?: string;

  /**
   * Not before (in seconds since Unix epoch)
   */
  nbf?: number;

  /**
   * Custom claims
   */
  [key: string]: any;
}

/**
 * JWT header
 */
interface JwtHeader {
  /**
   * Algorithm
   */
  alg: string;

  /**
   * Token type
   */
  typ: 'JWT';
}

/**
 * Sign a JWT token
 * @param payload The JWT payload
 * @param secret The secret key
 * @param options JWT options
 */
export function signJwt(
  payload: JwtPayload,
  secret: string,
  options: JwtOptions = { secret }
): string {
  const algorithm = options.algorithm || 'HS256';
  const expiresIn = options.expiresIn || 3600;

  // Create header
  const header: JwtHeader = {
    alg: algorithm,
    typ: 'JWT'
  };

  // Create payload with standard claims
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn
  };

  if (options.issuer) {
    jwtPayload.iss = options.issuer;
  }

  if (options.audience) {
    jwtPayload.aud = options.audience;
  }

  if (!jwtPayload.jti) {
    jwtPayload.jti = randomBytes(16).toString('hex');
  }

  // Encode header and payload
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(jwtPayload)).toString('base64url');

  // Create signature
  const data = `${encodedHeader}.${encodedPayload}`;
  const hmacAlgorithm = algorithm.replace('HS', 'sha');
  const signature = createHmac(hmacAlgorithm, secret).update(data).digest('base64url');

  // Return JWT token
  return `${data}.${signature}`;
}

/**
 * Verify a JWT token
 * @param token The JWT token
 * @param secret The secret key
 * @param options JWT options
 */
export function verifyJwt(
  token: string,
  secret: string,
  options: JwtOptions = { secret }
): JwtPayload {
  // Split token into parts
  const parts = token.split('.');

  if (parts.length !== 3) {
    throw new Error('Invalid JWT token format');
  }

  const [encodedHeader, encodedPayload, signature] = parts;

  // Decode header
  let header: JwtHeader;
  try {
    header = JSON.parse(Buffer.from(encodedHeader!, 'base64url').toString());
  } catch (_error) {
    throw new Error('Invalid JWT header');
  }

  // Verify algorithm
  const algorithm = options.algorithm || 'HS256';
  if (header.alg !== algorithm) {
    throw new Error(`Invalid JWT algorithm: ${header.alg}`);
  }

  // Verify signature
  const data = `${encodedHeader}.${encodedPayload}`;
  const hmacAlgorithm = algorithm.replace('HS', 'sha');
  const expectedSignature = createHmac(hmacAlgorithm, secret).update(data).digest('base64url');

  try {
    const signatureBuffer = Buffer.from(signature!, 'base64url');
    const expectedSignatureBuffer = Buffer.from(expectedSignature, 'base64url');

    if (!timingSafeEqual(signatureBuffer, expectedSignatureBuffer)) {
      throw new Error('Invalid JWT signature');
    }
  } catch (_error) {
    throw new Error('Invalid JWT signature');
  }

  // Decode payload
  let payload: JwtPayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload!, 'base64url').toString());
  } catch (_error) {
    throw new Error('Invalid JWT payload');
  }

  // Verify expiration
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && payload.exp < now) {
    throw new Error('JWT token has expired');
  }

  // Verify not before
  if (payload.nbf && payload.nbf > now) {
    throw new Error('JWT token not yet valid');
  }

  // Verify issuer
  if (options.issuer && payload.iss !== options.issuer) {
    throw new Error(`Invalid JWT issuer: ${payload.iss}`);
  }

  // Verify audience
  if (options.audience && payload.aud !== options.audience) {
    throw new Error(`Invalid JWT audience: ${payload.aud}`);
  }

  return payload;
}

/**
 * Extract token from request
 * @param req The incoming request
 */
function defaultExtractToken(req: IncomingMessage): string | null {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.substring(7);
}

/**
 * Create JWT authentication middleware
 * @param options JWT options
 */
export function createJwtAuthMiddleware(options: JwtOptions): MiddlewareHandler {
  const { secret, extractToken = defaultExtractToken } = options;

  return async (_req: IncomingMessage, res: ServerResponse, next: () => Promise<void>) => {
    const token = extractToken(_req);

    if (!token) {
      throw HttpException.unauthorized('No authentication token provided');
    }

    try {
      const payload = verifyJwt(token, secret, options);

      // Attach user to request
      (_req as any).user = payload;

      await next();
    } catch (error) {
      throw HttpException.unauthorized(`Invalid authentication token: ${(error as Error).message}`);
    }
  };
}
