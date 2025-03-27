/**
 * HTTP Utilities
 *
 * Helper functions for HTTP request and response handling
 */

interface RequestLike {
  method?: string;
  headers?: {
    [key: string]: string | string[] | undefined;
    'content-length'?: string;
    'content-type'?: string;
    'transfer-encoding'?: string;
  };
}

/**
 * Check if a request has a body based on method and headers
 * @param req - The HTTP request object
 * @returns True if request should have a body
 */
export function hasBody(req: RequestLike): boolean {
  if (!req) return false;

  // Methods that typically don't have a body
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method || '')) {
    return false;
  }

  // Check for Content-Length or Transfer-Encoding headers
  if (req.headers?.['content-length'] && parseInt(req.headers['content-length']) > 0) {
    return true;
  }

  if (req.headers?.['transfer-encoding'] !== undefined) {
    return true;
  }

  return false;
}

/**
 * Check if the request content type matches the specified type
 * @param req - The HTTP request object
 * @param type - The type(s) to match against
 * @returns True if the content type matches
 */
export function typeMatches(req: RequestLike, type: string | RegExp | string[]): boolean {
  if (!req?.headers?.['content-type']) {
    return false;
  }

  const contentType = req.headers['content-type'].toString().split(';')[0].trim();

  if (Array.isArray(type)) {
    return type.some(t => typeMatches(req, t));
  }

  if (type instanceof RegExp) {
    return type.test(contentType);
  }

  if (typeof type === 'string' && type.includes('*')) {
    const typeRegex = new RegExp('^' + type.replace('*', '.*') + '$');
    return typeRegex.test(contentType);
  }

  return contentType === type;
}

/**
 * Get the content type from the request
 * @param req - The HTTP request object
 * @returns The content type
 */
export function getContentType(req: RequestLike): string {
  if (!req?.headers?.['content-type']) {
    return '';
  }

  return req.headers['content-type'].toString().split(';')[0].trim();
}

/**
 * Parse a string value representing bytes into a number
 * @param val - The value to parse (e.g., '1mb', '500kb')
 * @returns The value in bytes
 */
export function bytes(val: string | number): number {
  if (typeof val === 'number') {
    return val;
  }

  if (typeof val !== 'string') {
    return 0;
  }

  const match = /^(\d+(?:\.\d+)?)([kmgt]b?)$/i.exec(val.toLowerCase().trim());
  if (!match) {
    return parseInt(val, 10) || 0;
  }

  const num = parseFloat(match[1]);
  const unit = match[2];

  const multiplier: Record<string, number> = {
    'b': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024,
    'tb': 1024 * 1024 * 1024 * 1024
  };

  return Math.floor(num * (multiplier[unit.toLowerCase()] || 1));
}

/**
 * Parse a URL-encoded string
 * @param str - URL-encoded string
 * @returns Parsed key-value pairs
 */
export function parseUrlEncodedText(str: string): Record<string, string> {
  const result: Record<string, string> = {};

  if (!str || typeof str !== 'string') {
    return result;
  }

  str.split('&').forEach(part => {
    const [key, value] = part.split('=').map(decodeURIComponent);
    if (key) {
      result[key] = value || '';
    }
  });

  return result;
}

/**
 * Generate a boundary for multipart form data
 * @returns A random boundary string
 */
export function generateBoundary(): string {
  return `---boundary-${Math.random().toString(36).substring(2)}`;
}

/**
 * Extract the boundary from a Content-Type header
 * @param contentType - The Content-Type header value
 * @returns The boundary or null if not found
 */
export function extractBoundary(contentType: string): string | null {
  if (!contentType) return null;

  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  return match ? (match[1] || match[2]) : null;
}

/**
 * Format HTTP headers to standard format
 * @param headers - Header object
 * @returns Formatted headers
 */
export function formatHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};

  if (!headers || typeof headers !== 'object') {
    return result;
  }

  Object.keys(headers).forEach(key => {
    // Convert header name to lowercase
    const headerName = key.toLowerCase();
    const value = headers[key];
    if (value !== undefined) {
      result[headerName] = value;
    }
  });

  return result;
}

/**
 * Check if a path matches a pattern with wildcards
 * @param path - The URL path
 * @param pattern - The pattern with wildcards
 * @returns True if path matches the pattern
 */
export function pathMatches(path: string, pattern: string): boolean {
  if (pattern === '*') return true;

  const patternParts = pattern.split('/');
  const pathParts = path.split('/');

  // If parts don't match in length and we don't have wildcards, fail immediately
  if (patternParts.length !== pathParts.length && !pattern.includes('*')) {
    return false;
  }

  // Check each part
  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    // We've run out of path parts, but still have pattern parts
    if (pathPart === undefined) {
      return false;
    }

    // Wildcard matches anything
    if (patternPart === '*') {
      continue;
    }

    // Parameter placeholders like :id match any non-empty segment
    if (patternPart.startsWith(':')) {
      if (pathPart.length === 0) {
        return false;
      }
      continue;
    }

    // Exact match required
    if (patternPart !== pathPart) {
      return false;
    }
  }

  return true;
}

export default {
  hasBody,
  typeMatches,
  getContentType,
  bytes,
  parseUrlEncodedText,
  generateBoundary,
  extractBoundary,
  formatHeaders,
  pathMatches
};
