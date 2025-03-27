/**
 * Router
 *
 * Features:
 * - Fast path optimization for common routes
 * - Route caching with TTL
 * - Instance pooling for better memory usage
 * - Compatible with existing Router API
 * - Integrated controller support
 */

import { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { HttpMethod } from '../http/http-method';
import { MiddlewareHandler, composeMiddleware } from '../middleware/middleware';
import { Container } from '../di/container';
import { getRouteMetadata } from '../decorators/route-decorators';
import { parseBody } from '../http/body-parser';
import { HttpException } from '../http/http-exception';

// Define route handler and related types
export type RouteHandler = (_req: IncomingMessage, _res: ServerResponse) => Promise<void>;

export interface Route {
  path: string;
  method: HttpMethod;
  handler: (_req: IncomingMessage, _res: ServerResponse) => Promise<any>;
  middlewares: MiddlewareHandler[];
  controller: any;
}

export interface RouteMatch {
  route: Route;
  params: Record<string, string>;
}

// Node types in radix tree
const _STATIC = 0;
const _PARAM = 1;
const _WILDCARD = 2;

/**
 * Memory-efficient node class with optimization for static nodes
 */
class RadixNode {
  // Node properties
  type: number = _STATIC;
  segment: string = '';
  paramName: string = '';
  children: RadixNode[] = [];
  routes: Map<HttpMethod, Route> = new Map();

  // Fast path optimization
  fastPaths: Map<string, RadixNode> = new Map();

  // For static nodes, use a bitmap index for fast child lookup
  staticChildrenIndex: Uint32Array | null = null;

  // Reusable param objects for better memory efficiency
  private static paramObjectPool: Record<string, string>[] = [];

  // Node pool for reuse
  private static nodePool: RadixNode[] = [];

  // Get a node from the pool or create a new one
  static getNode(): RadixNode {
    if (this.nodePool.length > 0) {
      const node = this.nodePool.pop()!;
      node.reset();
      return node;
    }
    return new RadixNode();
  }

  // Release a node back to the pool
  static releaseNode(node: RadixNode): void {
    if (this.nodePool.length < 1000) { // Limit pool size
      this.nodePool.push(node);
    }
  }

  // Reset node to initial state
  reset(): void {
    this.type = _STATIC;
    this.segment = '';
    this.paramName = '';
    this.children = [];
    this.routes.clear();
    this.fastPaths.clear();
    this.staticChildrenIndex = null;
  }

  // Get param object from pool
  static getParamObject(): Record<string, string> {
    if (this.paramObjectPool.length > 0) {
      return this.paramObjectPool.pop()!;
    }
    return {};
  }

  // Release param object back to pool
  static releaseParamObject(params: Record<string, string>): void {
    if (this.paramObjectPool.length < 1000) { // Limit pool size
      Object.keys(params).forEach(key => delete params[key]);
      this.paramObjectPool.push(params);
    }
  }

  // Add a route to the tree
  insert(path: string, route: Route): void {
    const normalizedPath = this.normalizePath(path);
    const segments = normalizedPath.split('/').filter(Boolean);

    this.insertInternal(segments, route, 0);

    // Build fast paths for common routes (direct children)
    if (segments.length === 1 && this.type === _STATIC) {
      this.fastPaths.set(`${route.method}:${segments[0]}`, this.children.find(c => c.segment === segments[0]) || this);
    }

    // Rebuild bitmap index for static children
    this.rebuildStaticIndex();
  }

  // Internal insertion method
  private insertInternal(segments: string[], route: Route, index: number): void {
    // If we reached the end of the path, store the route at this node
    if (index === segments.length) {
      this.routes.set(route.method, route);
      return;
    }

    const segment = segments[index];

    // Check if this is a parameter segment (:name)
    if (segment.startsWith(':')) {
      // Parameter node
      const paramName = segment.slice(1);
      let paramNode = this.children.find(child => child.type === _PARAM);

      if (!paramNode) {
        paramNode = RadixNode.getNode();
        paramNode.type = _PARAM;
        paramNode.paramName = paramName;
        this.children.push(paramNode);
      } else if (paramNode.paramName !== paramName) {
        throw new Error(`Cannot use two different param names for the same path segment: ${paramNode.paramName} and ${paramName}`);
      }

      paramNode.insertInternal(segments, route, index + 1);
      return;
    }

    // Check if this is a wildcard segment (*)
    if (segment === '*') {
      // Wildcard node
      let wildcardNode = this.children.find(child => child.type === _WILDCARD);

      if (!wildcardNode) {
        wildcardNode = RadixNode.getNode();
        wildcardNode.type = _WILDCARD;
        this.children.push(wildcardNode);
      }

      wildcardNode.routes.set(route.method, route);
      return;
    }

    // Static node
    let staticNode = this.children.find(child =>
      child.type === _STATIC && child.segment === segment
    );

    if (!staticNode) {
      staticNode = RadixNode.getNode();
      staticNode.type = _STATIC;
      staticNode.segment = segment!;
      this.children.push(staticNode);
    }

    staticNode.insertInternal(segments, route, index + 1);
  }

  // Rebuild the bitmap index for static children
  private rebuildStaticIndex(): void {
    const staticChildren = this.children.filter(child => child.type === _STATIC);

    if (staticChildren.length > 5) { // Only use bitmap for sufficient number of children
      // Create a 256-bit (32 byte) bitmap for ASCII chars
      this.staticChildrenIndex = new Uint32Array(8); // 8 * 32 = 256 bits

      // Set bits for the first character of each static child
      for (const child of staticChildren) {
        const charCode = child.segment.charCodeAt(0);
        const index = Math.floor(charCode / 32);
        const bit = charCode % 32;
        this.staticChildrenIndex[index] |= (1 << bit);
      }
    } else {
      this.staticChildrenIndex = null;
    }
  }

  // Find a route in the tree
  search(path: string, method: HttpMethod): RouteMatch | null {
    // Fast path check for common routes
    const fastPathKey = `${method}:${path.replace(/^\//, '')}`;
    const fastPathNode = this.fastPaths.get(fastPathKey);

    if (fastPathNode) {
      const route = fastPathNode.routes.get(method);
      if (route) {
        return {
          route,
          params: {}
        };
      }
    }

    // Normal path
    const normalizedPath = this.normalizePath(path);
    const segments = normalizedPath.split('/').filter(Boolean);
    const params = RadixNode.getParamObject();

    const route = this.searchInternal(segments, method, params, 0);

    if (route) {
      return { route, params };
    }

    // Release the params object back to the pool
    RadixNode.releaseParamObject(params);
    return null;
  }

  // Internal search method
  private searchInternal(
    segments: string[],
    method: HttpMethod,
    params: Record<string, string>,
    index: number
  ): Route | null {
    // If we reached the end of the path, look for a route at this node
    if (index === segments.length) {
      // Check for exact method match
      const route = this.routes.get(method);
      if (route) return route;

      // Check for ALL method match as fallback
      return this.routes.get(HttpMethod._ALL) || null;
    }

    const segment = segments[index];

    // Check static children with bitmap optimization
    if (this.staticChildrenIndex) {
      const charCode = segment.charCodeAt(0);
      const bitmapIndex = Math.floor(charCode / 32);
      const bit = charCode % 32;

      // If the bit is not set, no static child exists with this first character
      if (!(this.staticChildrenIndex[bitmapIndex] & (1 << bit))) {
        // Skip checking static children
      } else {
        // Try to match static nodes (most specific)
        for (const child of this.children) {
          if (child.type === _STATIC && child.segment === segment) {
            const route = child.searchInternal(segments, method, params, index + 1);
            if (route) return route;
            break; // No need to check other static children
          }
        }
      }
    } else {
      // Try to match static nodes (most specific) - fallback for nodes without bitmap
      for (const child of this.children) {
        if (child.type === _STATIC && child.segment === segment) {
          const route = child.searchInternal(segments, method, params, index + 1);
          if (route) return route;
          break; // No need to check other static children
        }
      }
    }

    // Try to match parameter nodes
    for (const child of this.children) {
      if (child.type === _PARAM) {
        params[child.paramName] = segment!;
        const route = child.searchInternal(segments, method, params, index + 1);
        if (route) return route;
        delete params[child.paramName];
      }
    }

    // Try to match wildcard nodes (least specific)
    for (const child of this.children) {
      if (child.type === _WILDCARD) {
        const route = child.routes.get(method) || child.routes.get(HttpMethod._ALL);
        return route || null;
      }
    }

    return null;
  }

  // Normalize a path (ensure leading slash, no trailing slash)
  private normalizePath(path: string): string {
    let normalized = path;

    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }

    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  }
}

/**
 * Router
 */
export class Router {
  private root = new RadixNode();
  private globalPrefix: string;
  private routeCache: Map<string, {
    result: RouteMatch | null;
    timestamp: number;
  }> = new Map();

  private readonly CACHE_MAX_SIZE = 10000; // Maximum cache size
  private readonly DEFAULT_TTL = 60000; // Default TTL: 1 minute
  private cacheTtl: number;
  private lastCacheCleanup: number = Date.now();
  private readonly CLEANUP_INTERVAL = 300000; // Cleanup interval: 5 minutes

  // Stats for monitoring
  private stats = {
    hits: 0,
    misses: 0,
    inserts: 0,
    searches: 0,
    expirations: 0
  };

  /**
   * Create a new router
   * @param globalPrefix Global prefix for all routes
   * @param options Router options
   */
  constructor(globalPrefix: string = '', options: { cacheTtl?: number } = {}) {
    this.globalPrefix = globalPrefix;
    this.cacheTtl = options.cacheTtl || this.DEFAULT_TTL;
  }

  /**
   * Configure caching behavior
   * @param options Caching options
   */
  configureCaching(options: {
    enabled?: boolean;
    maxSize?: number;
    ttl?: number;
  }): void {
    if (options.enabled === false) {
      this.routeCache.clear();
      this.cacheTtl = 0; // Disable caching
    } else {
      if (options.maxSize !== undefined && options.maxSize > 0) {
        // If cache size is being reduced, trim it
        if (options.maxSize < this.CACHE_MAX_SIZE && this.routeCache.size > options.maxSize) {
          const entriesToRemove = [...this.routeCache.entries()]
            .sort((a, b) => a[1].timestamp - b[1].timestamp)
            .slice(0, this.routeCache.size - options.maxSize);

          for (const [key] of entriesToRemove) {
            this.routeCache.delete(key);
          }
        }
      }

      if (options.ttl !== undefined) {
        this.cacheTtl = options.ttl;
        this.maybeCleanupCache(); // Clean up with new TTL
      }
    }
  }

  /**
   * Register routes from a controller
   * @param controller The controller to register routes from
   * @param container The dependency injection container
   */
  registerRoutes(controller: any, container: Container): void {
    const controllerInstance = container.resolve(controller);
    const controllerMetadata = getRouteMetadata(controller);

    if (!controllerMetadata?.path) {
      return;
    }

    const controllerPath = this.normalizePath(controllerMetadata.path);
    const controllerMiddlewares = controllerMetadata.middlewares || [];

    // Get all methods with route metadata
    for (const propertyKey of Object.getOwnPropertyNames(controller.prototype)) {
      if (propertyKey === 'constructor') continue;

      const routeMetadata = getRouteMetadata(controller.prototype, propertyKey);
      if (!routeMetadata?.method) continue;

      const routePath = this.normalizePath(routeMetadata.path || '/');
      const fullPath = this.combinePaths(this.globalPrefix, controllerPath, routePath);
      const methodMiddlewares = routeMetadata.middlewares || [];

      // Create route handler
      const routeHandler = async (req: IncomingMessage, res: ServerResponse): Promise<any> => {
        const method = controller.prototype[propertyKey];
        const params = this.extractParams(req);
        const query = this.extractQuery(req);
        const body = await parseBody(req);

        // Create context object with request data
        const context = {
          req,
          res,
          params,
          query,
          body
        };

        // Call the controller method with the context
        const result = await method.call(controllerInstance, context);

        // Send the response
        if (!res.writableEnded) {
          res.statusCode = routeMetadata.statusCode || 200;
          res.end(typeof result === 'string' ? result : JSON.stringify(result));
        }

        return result;
      };

      // Add the route to our radix tree
      this.addRoute(
        routeMetadata.method,
        fullPath,
        routeHandler,
        [...controllerMiddlewares, ...methodMiddlewares],
        controllerInstance
      );
    }
  }

  /**
   * Add a route to the router
   * @param method HTTP method
   * @param path Route path
   * @param handler Route handler
   * @param middlewares Middleware handlers
   * @param controller Controller instance
   */
  addRoute(
    method: HttpMethod,
    path: string,
    handler: RouteHandler,
    middlewares: MiddlewareHandler[] = [],
    controller: any = null
  ): void {
    // Clear cache when new routes are added
    this.routeCache.clear();

    const normalizedPath = this.normalizePath(path);
    this.root.insert(normalizedPath, {
      path: normalizedPath,
      method,
      handler,
      middlewares,
      controller
    });
  }

  /**
   * Process an incoming request
   * @param req The incoming request
   * @param res The server response
   */
  async process(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method as HttpMethod;
    const url = req.url || '/';

    // Find matching route
    const match = this.findRoute(method, url);

    if (!match) {
      throw new HttpException(404, `Cannot ${method} ${url}`);
    }

    const { route, params } = match;

    // Add params to request object
    (req as any).params = params;

    // Execute route middlewares
    if (route.middlewares.length > 0) {
      const composedMiddleware = composeMiddleware(route.middlewares);
      await composedMiddleware(req, res, async () => {
        await route.handler(req, res);
      });
    } else {
      await route.handler(req, res);
    }
  }

  /**
   * Find a matching route for the given method and URL
   * @param method The HTTP method
   * @param url The request URL
   */
  findRoute(method: HttpMethod, path: string): RouteMatch | null {
    this.stats.searches++;

    // Check routing cache first
    if (this.cacheTtl > 0) {
      this.maybeCleanupCache();

      const cacheKey = `${method}:${path}`;
      const cached = this.routeCache.get(cacheKey);

      if (cached) {
        const now = Date.now();
        if (now - cached.timestamp < this.cacheTtl) {
          this.stats.hits++;
          return cached.result;
        } else {
          // Remove expired entry
          this.routeCache.delete(cacheKey);
          this.stats.expirations++;
        }
      }

      // Cache miss - perform lookup
      this.stats.misses++;

      // Parse the URL to get the pathname
      const parsedUrl = new URL(path, 'http://localhost');
      const pathname = parsedUrl.pathname;

      // Search for a route match
      const result = this.root.search(pathname, method);

      // Cache the result
      if (this.routeCache.size < this.CACHE_MAX_SIZE) {
        this.routeCache.set(cacheKey, {
          result,
          timestamp: Date.now()
        });
        this.stats.inserts++;
      }

      return result;
    } else {
      // Caching disabled - perform lookup directly
      const parsedUrl = new URL(path, 'http://localhost');
      const pathname = parsedUrl.pathname;
      return this.root.search(pathname, method);
    }
  }

  /**
   * Periodically clean up expired cache entries
   */
  private maybeCleanupCache(): void {
    const now = Date.now();

    // Only clean up at intervals to avoid performance impact
    if (now - this.lastCacheCleanup > this.CLEANUP_INTERVAL) {
      this.lastCacheCleanup = now;

      let expiredCount = 0;
      for (const [key, entry] of this.routeCache.entries()) {
        if (now - entry.timestamp > this.cacheTtl) {
          this.routeCache.delete(key);
          expiredCount++;
        }
      }

      if (expiredCount > 0) {
        this.stats.expirations += expiredCount;
      }
    }
  }

  /**
   * Get router performance statistics
   */
  getStats(): {
    hits: number,
    misses: number,
    inserts: number,
    searches: number,
    expirations: number,
    cacheSize: number,
    cacheTtl: number
  } {
    return {
      ...this.stats,
      cacheSize: this.routeCache.size,
      cacheTtl: this.cacheTtl
    };
  }

  /**
   * Clear the route cache
   */
  clearCache(): void {
    this.routeCache.clear();
  }

  /**
   * Extract query parameters from the request
   * @param req The incoming request
   */
  private extractQuery(req: IncomingMessage): Record<string, string> {
    const url = req.url || '/';
    const parsedUrl = new URL(url, 'http://localhost');
    const query: Record<string, string> = {};

    for (const [key, value] of parsedUrl.searchParams.entries()) {
      query[key] = value;
    }

    return query;
  }

  /**
   * Extract path parameters from the request
   * @param req The incoming request
   */
  private extractParams(req: IncomingMessage): Record<string, string> {
    return (req as any).params || {};
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

    if (normalized.length > 1 && normalized.endsWith('/')) {
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

  /**
   * Add a GET route
   * @param path Route path
   * @param handler Route handler
   * @param middlewares Middleware handlers
   * @param controller Controller instance
   */
  get(
    path: string,
    handler: RouteHandler,
    middlewares: MiddlewareHandler[] = [],
    controller: any = null
  ): void {
    this.addRoute(HttpMethod._GET, path, handler, middlewares, controller);
  }

  /**
   * Add a POST route
   * @param path Route path
   * @param handler Route handler
   * @param middlewares Middleware handlers
   * @param controller Controller instance
   */
  post(
    path: string,
    handler: RouteHandler,
    middlewares: MiddlewareHandler[] = [],
    controller: any = null
  ): void {
    this.addRoute(HttpMethod._POST, path, handler, middlewares, controller);
  }

  /**
   * Add a PUT route
   * @param path Route path
   * @param handler Route handler
   * @param middlewares Middleware handlers
   * @param controller Controller instance
   */
  put(
    path: string,
    handler: RouteHandler,
    middlewares: MiddlewareHandler[] = [],
    controller: any = null
  ): void {
    this.addRoute(HttpMethod._PUT, path, handler, middlewares, controller);
  }

  /**
   * Add a DELETE route
   * @param path Route path
   * @param handler Route handler
   * @param middlewares Middleware handlers
   * @param controller Controller instance
   */
  delete(
    path: string,
    handler: RouteHandler,
    middlewares: MiddlewareHandler[] = [],
    controller: any = null
  ): void {
    this.addRoute(HttpMethod._DELETE, path, handler, middlewares, controller);
  }

  /**
   * Add a PATCH route
   * @param path Route path
   * @param handler Route handler
   * @param middlewares Middleware handlers
   * @param controller Controller instance
   */
  patch(
    path: string,
    handler: RouteHandler,
    middlewares: MiddlewareHandler[] = [],
    controller: any = null
  ): void {
    this.addRoute(HttpMethod._PATCH, path, handler, middlewares, controller);
  }

  /**
   * Add a OPTIONS route
   * @param path Route path
   * @param handler Route handler
   * @param middlewares Middleware handlers
   * @param controller Controller instance
   */
  options(
    path: string,
    handler: RouteHandler,
    middlewares: MiddlewareHandler[] = [],
    controller: any = null
  ): void {
    this.addRoute(HttpMethod._OPTIONS, path, handler, middlewares, controller);
  }

  /**
   * Add a HEAD route
   * @param path Route path
   * @param handler Route handler
   * @param middlewares Middleware handlers
   * @param controller Controller instance
   */
  head(
    path: string,
    handler: RouteHandler,
    middlewares: MiddlewareHandler[] = [],
    controller: any = null
  ): void {
    this.addRoute(HttpMethod._HEAD, path, handler, middlewares, controller);
  }

  /**
   * Add a route for all HTTP methods
   * @param path Route path
   * @param handler Route handler
   * @param middlewares Middleware handlers
   * @param controller Controller instance
   */
  all(
    path: string,
    handler: RouteHandler,
    middlewares: MiddlewareHandler[] = [],
    controller: any = null
  ): void {
    this.addRoute(HttpMethod._ALL, path, handler, middlewares, controller);
  }
}

// Export a compatibility interface for RadixRouter
export class RadixRouter {
  private router: Router;

  constructor(globalPrefix: string = '') {
    this.router = new Router(globalPrefix);
  }

  addRoute(
    method: HttpMethod,
    path: string,
    handler: RouteHandler,
    middlewares: MiddlewareHandler[] = [],
    controller: any = null
  ): void {
    this.router.addRoute(method, path, handler, middlewares, controller);
  }

  findRoute(method: HttpMethod, path: string): RouteMatch | null {
    return this.router.findRoute(method, path);
  }

  /**
   * Add a GET route
   */
  get(path: string, handler: RouteHandler, middlewares: MiddlewareHandler[] = [], controller: any = null): void {
    this.router.get(path, handler, middlewares, controller);
  }

  /**
   * Add a POST route
   */
  post(path: string, handler: RouteHandler, middlewares: MiddlewareHandler[] = [], controller: any = null): void {
    this.router.post(path, handler, middlewares, controller);
  }

  /**
   * Add a PUT route
   */
  put(path: string, handler: RouteHandler, middlewares: MiddlewareHandler[] = [], controller: any = null): void {
    this.router.put(path, handler, middlewares, controller);
  }

  /**
   * Add a DELETE route
   */
  delete(path: string, handler: RouteHandler, middlewares: MiddlewareHandler[] = [], controller: any = null): void {
    this.router.delete(path, handler, middlewares, controller);
  }

  /**
   * Add a PATCH route
   */
  patch(path: string, handler: RouteHandler, middlewares: MiddlewareHandler[] = [], controller: any = null): void {
    this.router.patch(path, handler, middlewares, controller);
  }

  /**
   * Add a OPTIONS route
   */
  options(path: string, handler: RouteHandler, middlewares: MiddlewareHandler[] = [], controller: any = null): void {
    this.router.options(path, handler, middlewares, controller);
  }

  /**
   * Add a HEAD route
   */
  head(path: string, handler: RouteHandler, middlewares: MiddlewareHandler[] = [], controller: any = null): void {
    this.router.head(path, handler, middlewares, controller);
  }

  /**
   * Add a route that matches all HTTP methods
   */
  all(path: string, handler: RouteHandler, middlewares: MiddlewareHandler[] = [], controller: any = null): void {
    this.router.all(path, handler, middlewares, controller);
  }
}
