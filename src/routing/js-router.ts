import { HttpMethod } from '../types/index.js';

/**
 * JavaScript implementation of RadixRouter
 * This serves as a fallback when the native implementation is not available
 */
export class JsRadixRouter {
  private routes: Map<string, any>;

  constructor() {
    this.routes = new Map();
  }

  /**
   * Add a route to the router
   * @param method HTTP method
   * @param path Route path
   * @param handler Route handler
   */
  addRoute(method: HttpMethod, path: string, handler: any): void {
    const fullPath = this.normalizePath(path);
    const key = `${method}:${fullPath}`;
    this.routes.set(key, {
      method,
      path: fullPath,
      handler,
      paramNames: this.extractParamNames(fullPath)
    });
  }

  /**
   * Find a route handler
   * @param method HTTP method
   * @param path Request path
   * @returns Route match result
   */
  findRoute(method: HttpMethod, path: string): { found: boolean; handler?: any; params: Record<string, string> } {
    const normalizedPath = this.normalizePath(path);

    // First try exact match
    const exactKey = `${method}:${normalizedPath}`;
    const exactRoute = this.routes.get(exactKey);
    if (exactRoute) {
      return {
        found: true,
        handler: exactRoute.handler,
        params: {}
      };
    }

    // Try to match routes with parameters
    for (const [routeKey, routeValue] of this.routes) {
      const [routeMethod] = routeKey.split(':');
      if (routeMethod === method) {
        const params = this.matchPath(routeValue.path, normalizedPath, routeValue.paramNames);
        if (params !== null) {
          return {
            found: true,
            handler: routeValue.handler,
            params
          };
        }
      }
    }

    return {
      found: false,
      params: {}
    };
  }

  /**
   * Remove a route from the router
   * @param method HTTP method
   * @param path Route path
   * @returns True if the route was removed, false otherwise
   */
  removeRoute(method: HttpMethod, path: string): boolean {
    const normalizedPath = this.normalizePath(path);
    const key = `${method}:${normalizedPath}`;
    return this.routes.delete(key);
  }

  /**
   * Extract parameter names from a path
   * @param path Route path pattern
   * @returns Array of parameter names
   */
  private extractParamNames(path: string): string[] {
    const paramNames: string[] = [];
    const parts = path.split('/');
    for (const part of parts) {
      if (part.startsWith(':')) {
        paramNames.push(part.slice(1));
      }
    }
    return paramNames;
  }

  /**
   * Normalize a path by ensuring it starts with a slash and handling trailing slashes
   * @param path Path to normalize
   * @returns Normalized path
   */
  private normalizePath(path: string): string {
    let normalizedPath = path;
    if (!normalizedPath.startsWith('/')) {
      normalizedPath = `/${  normalizedPath}`;
    }
    // Keep trailing slash if present in original path
    return normalizedPath;
  }

  /**
   * Match a route path against a request path
   * @param routePath Route path pattern
   * @param requestPath Actual request path
   * @param paramNames Array of parameter names
   * @returns Parameters if path matches, null otherwise
   */
  private matchPath(routePath: string, requestPath: string, paramNames: string[]): Record<string, string> | null {
    // Handle trailing slashes
    const routeHasTrailingSlash = routePath.endsWith('/');
    const requestHasTrailingSlash = requestPath.endsWith('/');

    // If one has a trailing slash and the other doesn't, they don't match
    if (routeHasTrailingSlash !== requestHasTrailingSlash) {
      return null;
    }

    // Split paths into segments
    const routeParts = routePath.split('/').filter(Boolean);
    const requestParts = requestPath.split('/').filter(Boolean);

    // If the number of parts doesn't match, paths don't match
    if (routeParts.length !== requestParts.length) {
      return null;
    }

    const params: Record<string, string> = {};
    let paramIndex = 0;

    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i];
      const requestPart = requestParts[i];

      if (routePart.startsWith(':')) {
        // This is a parameter
        params[paramNames[paramIndex++]] = requestPart;
      } else if (routePart !== requestPart) {
        // Static parts must match exactly
        return null;
      }
    }

    return params;
  }
}
