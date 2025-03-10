import { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { Container } from '../di/container.js';
import { HttpMethod } from '../http/http-method.js';
import { getRouteMetadata } from '../decorators/route-decorators.js';
import { MiddlewareHandler, composeMiddleware } from '../middleware/middleware.js';
import { parseBody } from '../http/body-parser.js';
import { HttpException } from '../http/http-exception.js';

interface Route {
  path: string;
  method: HttpMethod;
  handler: (_req: IncomingMessage, _res: ServerResponse) => Promise<any>;
  middlewares: MiddlewareHandler[];
  controller: any;
}

interface RouteMatch {
  route: Route;
  params: Record<string, string>;
}

export class Router {
  private routes: Route[] = [];
  private globalPrefix: string;

  constructor(globalPrefix: string = '') {
    this.globalPrefix = globalPrefix;
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

      // Register the route
      this.routes.push({
        path: fullPath,
        method: routeMetadata.method,
        handler: routeHandler,
        middlewares: [...controllerMiddlewares, ...methodMiddlewares],
        controller: controllerInstance
      });
    }
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
  private findRoute(method: HttpMethod, url: string): RouteMatch | null {
    const parsedUrl = new URL(url, 'http://localhost');
    const pathname = parsedUrl.pathname;

    for (const route of this.routes) {
      if (route.method !== method) continue;

      const params = this.matchPath(route.path, pathname);
      if (params !== null) {
        return { route, params };
      }
    }

    return null;
  }

  /**
   * Match a route path against a request path
   * @param routePath The route path pattern
   * @param requestPath The actual request path
   */
  private matchPath(routePath: string, requestPath: string): Record<string, string> | null {
    // Convert route path to regex pattern
    const paramNames: string[] = [];
    let pattern = routePath
      .replace(/\/+$/, '')  // Remove trailing slashes
      .replace(/\/:([^/]+)/g, (_, paramName) => {
        paramNames.push(paramName);
        return '/([^/]+)';
      })
      .replace(/\*/g, '.*');

    // Add start and end anchors
    pattern = `^${pattern}/?$`;

    const regex = new RegExp(pattern);
    const match = requestPath.match(regex);

    if (!match) return null;

    // Extract params
    const params: Record<string, string> = {};
    for (let i = 0; i < paramNames.length; i++) {
      params[paramNames[i]] = match[i + 1];
    }

    return params;
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
