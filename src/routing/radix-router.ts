/**
 * Optimized router implementation using a radix tree for faster lookups
 */

import { IncomingMessage, ServerResponse } from 'node:http';
import { HttpMethod } from '../http/http-method.js';
import { MiddlewareHandler } from '../middleware/middleware.js';

/**
 * Route handler function
 */
export type RouteHandler = (_req: IncomingMessage, _res: ServerResponse) => Promise<void>;

/**
 * Route definition
 */
export interface RadixRoute {
  /**
   * HTTP method
   */
  method: HttpMethod;

  /**
   * Route handler
   */
  handler: RouteHandler;

  /**
   * Route middlewares
   */
  middlewares: MiddlewareHandler[];

  /**
   * Controller instance
   */
  controller: any;
}

/**
 * Route match result
 */
export interface RadixRouteMatch {
  /**
   * Matched route
   */
  route: RadixRoute;

  /**
   * Path parameters
   */
  params: Record<string, string>;
}

// Node types
const _STATIC = 0;
const _PARAM = 1;
const _WILDCARD = 2;

/**
 * Node in the radix tree
 */
class RadixNode {
  /**
   * Node type
   */
  type: number = _STATIC;

  /**
   * Path segment
   */
  segment: string = '';

  /**
   * Parameter name (for param nodes)
   */
  paramName: string = '';

  /**
   * Child nodes
   */
  children: RadixNode[] = [];

  /**
   * Routes at this node
   */
  routes: Map<HttpMethod, RadixRoute> = new Map();

  /**
   * Insert a route into the tree
   * @param path The route path
   * @param route The route definition
   */
  insert(path: string, route: RadixRoute): void {
    this.insertInternal(this.normalizePath(path).split('/').filter(Boolean), route, 0);
  }

  /**
   * Internal method to insert a route into the tree
   * @param segments The path segments
   * @param route The route definition
   * @param index The current segment index
   */
  private insertInternal(segments: string[], route: RadixRoute, index: number): void {
    // If we've processed all segments, store the route at this node
    if (index === segments.length) {
      this.routes.set(route.method, route);
      return;
    }

    const segment = segments[index];

    // Check if this is a parameter segment
    if (segment.startsWith(':')) {
      const paramName = segment.substring(1);

      // Find or create a parameter node
      let paramNode = this.children.find(child =>
        child.type === _PARAM && child.paramName === paramName
      );

      if (!paramNode) {
        paramNode = new RadixNode();
        paramNode.type = _PARAM;
        paramNode.paramName = paramName;
        this.children.push(paramNode);
      }

      // Continue with the next segment
      paramNode.insertInternal(segments, route, index + 1);
      return;
    }

    // Check if this is a wildcard segment
    if (segment === '*') {
      // Find or create a wildcard node
      let wildcardNode = this.children.find(child => child.type === _WILDCARD);

      if (!wildcardNode) {
        wildcardNode = new RadixNode();
        wildcardNode.type = _WILDCARD;
        this.children.push(wildcardNode);
      }

      // Store the route at the wildcard node
      wildcardNode.routes.set(route.method, route);
      return;
    }

    // This is a static segment
    // Find or create a static node
    let staticNode = this.children.find(child =>
      child.type === _STATIC && child.segment === segment
    );

    if (!staticNode) {
      staticNode = new RadixNode();
      staticNode.type = _STATIC;
      staticNode.segment = segment!;
      this.children.push(staticNode);
    }

    // Continue with the next segment
    staticNode.insertInternal(segments, route, index + 1);
  }

  /**
   * Search for a route in the tree
   * @param path The request path
   * @param method The HTTP method
   */
  search(path: string, method: HttpMethod): RadixRouteMatch | null {
    const segments = this.normalizePath(path).split('/').filter(Boolean);
    const params: Record<string, string> = {};

    const route = this.searchInternal(segments, method, params, 0);

    if (!route) {
      return null;
    }

    return { route, params };
  }

  /**
   * Internal method to search for a route in the tree
   * @param segments The path segments
   * @param method The HTTP method
   * @param params The path parameters
   * @param index The current segment index
   */
  private searchInternal(
    segments: string[],
    method: HttpMethod,
    params: Record<string, string>,
    index: number
  ): RadixRoute | null {
    // If we've processed all segments, check for a route at this node
    if (index === segments.length) {
      // Check for an exact method match
      if (this.routes.has(method)) {
        return this.routes.get(method)!;
      }

      // Check for an ALL method match
      if (this.routes.has(HttpMethod._ALL)) {
        return this.routes.get(HttpMethod._ALL)!;
      }

      return null;
    }

    const segment = segments[index];

    // Try to match static nodes first (most specific)
    for (const child of this.children) {
      if (child.type === _STATIC && child.segment === segment) {
        const route = child.searchInternal(segments, method, params, index + 1);
        if (route) {
          return route;
        }
      }
    }

    // Try to match parameter nodes next
    for (const child of this.children) {
      if (child.type === _PARAM) {
        // Store the parameter value
        params[child.paramName] = segment!;

        const route = child.searchInternal(segments, method, params, index + 1);
        if (route) {
          return route;
        }

        // Remove the parameter if no match was found
        delete params[child.paramName];
      }
    }

    // Try to match wildcard nodes last (least specific)
    for (const child of this.children) {
      if (child.type === _WILDCARD) {
        // Check for an exact method match
        if (child.routes.has(method)) {
          return child.routes.get(method)!;
        }

        // Check for an ALL method match
        if (child.routes.has(HttpMethod._ALL)) {
          return child.routes.get(HttpMethod._ALL)!;
        }
      }
    }

    return null;
  }

  /**
   * Normalize a path by ensuring it starts with a slash and has no trailing slash
   * @param path The path to normalize
   */
  private normalizePath(path: string): string {
    let normalized = path;

    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }

    if (normalized.endsWith('/') && normalized.length > 1) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  }
}

/**
 * Radix tree router for efficient route lookups
 */
export class RadixRouter {
  private root = new RadixNode();
  private globalPrefix: string;

  /**
   * Create a new radix router
   * @param globalPrefix Global prefix for all routes
   */
  constructor(globalPrefix: string = '') {
    this.globalPrefix = this.normalizePath(globalPrefix);
  }

  /**
   * Add a route to the router
   * @param method The HTTP method
   * @param path The route path
   * @param handler The route handler
   * @param middlewares The route middlewares
   * @param controller The controller instance
   */
  addRoute(
    method: HttpMethod,
    path: string,
    handler: RouteHandler,
    middlewares: MiddlewareHandler[] = [],
    controller: any = null
  ): void {
    const fullPath = this.combinePaths(this.globalPrefix, path);

    const route: RadixRoute = {
      method,
      handler,
      middlewares,
      controller
    };

    this.root.insert(fullPath, route);
  }

  /**
   * Find a route for the given method and path
   * @param method The HTTP method
   * @param path The request path
   */
  findRoute(method: HttpMethod, path: string): RadixRouteMatch | null {
    return this.root.search(path, method);
  }

  /**
   * Normalize a path by ensuring it starts with a slash and has no trailing slash
   * @param path The path to normalize
   */
  private normalizePath(path: string): string {
    let normalized = path;

    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }

    if (normalized.endsWith('/') && normalized.length > 1) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  }

  /**
   * Combine multiple path segments into a single path
   * @param paths The path segments to combine
   */
  private combinePaths(...paths: string[]): string {
    return paths
      .filter(Boolean)
      .map(path => this.normalizePath(path))
      .join('')
      .replace(/\/+/g, '/');
  }
}
