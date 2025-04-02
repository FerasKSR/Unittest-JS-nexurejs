import { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Type definition for middleware handlers
 */
export type MiddlewareHandler = (
  _req: IncomingMessage,
  _res: ServerResponse,
  _next: () => Promise<void>
) => Promise<void>;

/**
 * Middleware class for creating reusable middleware
 */
export abstract class Middleware {
  /**
   * Method to be implemented by middleware classes
   */
  abstract use(
    _req: IncomingMessage,
    _res: ServerResponse,
    _next: () => Promise<void>
  ): Promise<void>;

  /**
   * Returns the middleware handler
   */
  getHandler(): MiddlewareHandler {
    return this.use.bind(this);
  }
}

/**
 * Middleware factory for creating middleware from functions
 * @param handler The middleware handler function
 */
export function createMiddleware(handler: MiddlewareHandler): MiddlewareHandler {
  return handler;
}

/**
 * Compose multiple middleware into a single middleware
 * @param middlewares Array of middleware handlers to compose
 */
export function composeMiddleware(middlewares: MiddlewareHandler[]): MiddlewareHandler {
  return async (req: IncomingMessage, res: ServerResponse, next: () => Promise<void>) => {
    let index = 0;

    const dispatch = async (): Promise<void> => {
      if (index >= middlewares.length) {
        return next();
      }

      const middleware = middlewares[index++]!;
      await middleware(req, res, dispatch);
    };

    await dispatch();
  };
}
