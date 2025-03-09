/**
 * Security headers middleware
 */

import { IncomingMessage, ServerResponse } from 'node:http';
import { MiddlewareHandler } from '../middleware/middleware.js';

/**
 * Security headers options
 */
export interface SecurityHeadersOptions {
  /**
   * Content Security Policy
   * @default "default-src 'self'"
   */
  contentSecurityPolicy?: string | false;

  /**
   * X-Frame-Options
   * @default "SAMEORIGIN"
   */
  frameOptions?: 'DENY' | 'SAMEORIGIN' | false;

  /**
   * X-Content-Type-Options
   * @default "nosniff"
   */
  contentTypeOptions?: 'nosniff' | false;

  /**
   * X-XSS-Protection
   * @default "1; mode=block"
   */
  xssProtection?: string | false;

  /**
   * Strict-Transport-Security
   * @default "max-age=15552000; includeSubDomains"
   */
  strictTransportSecurity?: string | false;

  /**
   * Referrer-Policy
   * @default "no-referrer-when-downgrade"
   */
  referrerPolicy?: string | false;

  /**
   * Permissions-Policy
   */
  permissionsPolicy?: string | false;

  /**
   * Cache-Control
   * @default "no-store, no-cache, must-revalidate, proxy-revalidate"
   */
  cacheControl?: string | false;

  /**
   * Pragma
   * @default "no-cache"
   */
  pragma?: string | false;

  /**
   * Expires
   * @default "0"
   */
  expires?: string | false;

  /**
   * Cross-Origin-Embedder-Policy
   */
  crossOriginEmbedderPolicy?: string | false;

  /**
   * Cross-Origin-Opener-Policy
   */
  crossOriginOpenerPolicy?: string | false;

  /**
   * Cross-Origin-Resource-Policy
   */
  crossOriginResourcePolicy?: string | false;

  /**
   * Origin-Agent-Cluster
   */
  originAgentCluster?: '?1' | false;
}

/**
 * Create security headers middleware
 * @param options Security headers options
 */
export function createSecurityHeadersMiddleware(
  options: SecurityHeadersOptions = {}
): MiddlewareHandler {
  // Set default options
  const contentSecurityPolicy = options.contentSecurityPolicy !== undefined
    ? options.contentSecurityPolicy
    : "default-src 'self'";

  const frameOptions = options.frameOptions !== undefined
    ? options.frameOptions
    : 'SAMEORIGIN';

  const contentTypeOptions = options.contentTypeOptions !== undefined
    ? options.contentTypeOptions
    : 'nosniff';

  const xssProtection = options.xssProtection !== undefined
    ? options.xssProtection
    : '1; mode=block';

  const strictTransportSecurity = options.strictTransportSecurity !== undefined
    ? options.strictTransportSecurity
    : 'max-age=15552000; includeSubDomains';

  const referrerPolicy = options.referrerPolicy !== undefined
    ? options.referrerPolicy
    : 'no-referrer-when-downgrade';

  const permissionsPolicy = options.permissionsPolicy;

  const cacheControl = options.cacheControl !== undefined
    ? options.cacheControl
    : 'no-store, no-cache, must-revalidate, proxy-revalidate';

  const pragma = options.pragma !== undefined
    ? options.pragma
    : 'no-cache';

  const expires = options.expires !== undefined
    ? options.expires
    : '0';

  const crossOriginEmbedderPolicy = options.crossOriginEmbedderPolicy;
  const crossOriginOpenerPolicy = options.crossOriginOpenerPolicy;
  const crossOriginResourcePolicy = options.crossOriginResourcePolicy;
  const originAgentCluster = options.originAgentCluster;

  return async (req: IncomingMessage, res: ServerResponse, next: () => Promise<void>) => {
    // Set security headers
    if (contentSecurityPolicy) {
      res.setHeader('Content-Security-Policy', contentSecurityPolicy);
    }

    if (frameOptions) {
      res.setHeader('X-Frame-Options', frameOptions);
    }

    if (contentTypeOptions) {
      res.setHeader('X-Content-Type-Options', contentTypeOptions);
    }

    if (xssProtection) {
      res.setHeader('X-XSS-Protection', xssProtection);
    }

    if (strictTransportSecurity) {
      res.setHeader('Strict-Transport-Security', strictTransportSecurity);
    }

    if (referrerPolicy) {
      res.setHeader('Referrer-Policy', referrerPolicy);
    }

    if (permissionsPolicy) {
      res.setHeader('Permissions-Policy', permissionsPolicy);
    }

    if (cacheControl) {
      res.setHeader('Cache-Control', cacheControl);
    }

    if (pragma) {
      res.setHeader('Pragma', pragma);
    }

    if (expires) {
      res.setHeader('Expires', expires);
    }

    if (crossOriginEmbedderPolicy) {
      res.setHeader('Cross-Origin-Embedder-Policy', crossOriginEmbedderPolicy);
    }

    if (crossOriginOpenerPolicy) {
      res.setHeader('Cross-Origin-Opener-Policy', crossOriginOpenerPolicy);
    }

    if (crossOriginResourcePolicy) {
      res.setHeader('Cross-Origin-Resource-Policy', crossOriginResourcePolicy);
    }

    if (originAgentCluster) {
      res.setHeader('Origin-Agent-Cluster', originAgentCluster);
    }

    await next();
  };
}
