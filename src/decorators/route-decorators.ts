import 'reflect-metadata';
import { HttpMethod } from '../http/http-method.js';
import { MiddlewareHandler } from '../middleware/middleware.js';

/**
 * Metadata key for route information
 */
const ROUTE_METADATA_KEY = Symbol('nexure:route');

/**
 * Route metadata
 */
export interface RouteMetadata {
  /**
   * Route path
   */
  path?: string;

  /**
   * HTTP method
   */
  method?: HttpMethod;

  /**
   * HTTP status code
   */
  statusCode?: number;

  /**
   * Route middlewares
   */
  middlewares?: MiddlewareHandler[];
}

/**
 * Get route metadata from a target
 * @param target The target to get metadata from
 * @param propertyKey Optional property key
 */
export function getRouteMetadata(
  target: any,
  propertyKey?: string | symbol
): RouteMetadata | undefined {
  if (propertyKey) {
    return Reflect.getMetadata(ROUTE_METADATA_KEY, target, propertyKey);
  }

  return Reflect.getMetadata(ROUTE_METADATA_KEY, target);
}

/**
 * Set route metadata on a target
 * @param metadata The metadata to set
 * @param target The target to set metadata on
 * @param propertyKey Optional property key
 */
function setRouteMetadata(
  metadata: RouteMetadata,
  target: any,
  propertyKey?: string | symbol
): void {
  if (propertyKey) {
    const existingMetadata = getRouteMetadata(target, propertyKey) || {};
    Reflect.defineMetadata(
      ROUTE_METADATA_KEY,
      { ...existingMetadata, ...metadata },
      target,
      propertyKey
    );
  } else {
    const existingMetadata = getRouteMetadata(target) || {};
    Reflect.defineMetadata(ROUTE_METADATA_KEY, { ...existingMetadata, ...metadata }, target);
  }
}

/**
 * Controller decorator - defines a route controller
 * @param path The base path for the controller
 */
export function Controller(path: string = '/'): ClassDecorator {
  return (target: any) => {
    setRouteMetadata({ path }, target);
    return target;
  };
}

/**
 * Create a route method decorator
 * @param method The HTTP method
 * @param path The route path
 * @param statusCode The HTTP status code
 */
function createRouteDecorator(
  method: HttpMethod,
  path: string = '/',
  statusCode: number = 200
): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    setRouteMetadata({ method, path, statusCode }, target, propertyKey);
    return descriptor;
  };
}

/**
 * GET route decorator
 * @param path The route path
 * @param statusCode The HTTP status code
 */
export function Get(path: string, statusCode = 200): MethodDecorator {
  return createRouteDecorator(HttpMethod.GET, path, statusCode);
}

/**
 * POST route decorator
 * @param path The route path
 * @param statusCode The HTTP status code
 */
export function Post(path: string, statusCode = 201): MethodDecorator {
  return createRouteDecorator(HttpMethod.POST, path, statusCode);
}

/**
 * PUT route decorator
 * @param path The route path
 * @param statusCode The HTTP status code
 */
export function Put(path: string, statusCode = 200): MethodDecorator {
  return createRouteDecorator(HttpMethod.PUT, path, statusCode);
}

/**
 * DELETE route decorator
 * @param path The route path
 * @param statusCode The HTTP status code
 */
export function Delete(path: string, statusCode = 204): MethodDecorator {
  return createRouteDecorator(HttpMethod.DELETE, path, statusCode);
}

/**
 * PATCH route decorator
 * @param path The route path
 * @param statusCode The HTTP status code
 */
export function Patch(path: string, statusCode = 200): MethodDecorator {
  return createRouteDecorator(HttpMethod.PATCH, path, statusCode);
}

/**
 * HEAD route decorator
 * @param path The route path
 * @param statusCode The HTTP status code
 */
export function Head(path: string, statusCode = 200): MethodDecorator {
  return createRouteDecorator(HttpMethod.HEAD, path, statusCode);
}

/**
 * OPTIONS route decorator
 * @param path The route path
 * @param statusCode The HTTP status code
 */
export function Options(path: string, statusCode = 200): MethodDecorator {
  return createRouteDecorator(HttpMethod.OPTIONS, path, statusCode);
}

/**
 * ALL route decorator - matches any HTTP method
 * @param path The route path
 * @param statusCode The HTTP status code
 */
export function All(path: string, statusCode = 200): MethodDecorator {
  return createRouteDecorator(HttpMethod.ALL, path, statusCode);
}

/**
 * Use middleware decorator - applies middleware to a route or controller
 * @param middlewares The middlewares to apply
 */
export function Use(...middlewares: MiddlewareHandler[]): MethodDecorator & ClassDecorator {
  return (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (propertyKey && descriptor) {
      // Method decorator
      setRouteMetadata({ middlewares }, target, propertyKey);
      return descriptor;
    } else {
      // Class decorator
      setRouteMetadata({ middlewares }, target);
      return target;
    }
  };
}

/**
 * Status decorator - sets the HTTP status code for a route
 * @param statusCode The HTTP status code
 */
export function Status(statusCode: number): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    setRouteMetadata({ statusCode }, target, propertyKey);
    return descriptor;
  };
}
