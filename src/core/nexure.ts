import { createServer, Server, IncomingMessage, ServerResponse } from 'node:http';
import { Router } from '../routing/router.js';
import { MiddlewareHandler } from '../middleware/middleware.js';
import { Container } from '../di/container.js';
import { Logger } from '../utils/logger.js';

export interface NexureOptions {
  /**
   * Enable logging
   * @default true
   */
  logging?: boolean;

  /**
   * Enable pretty JSON responses
   * @default false
   */
  prettyJson?: boolean;

  /**
   * Global prefix for all routes
   * @default ''
   */
  globalPrefix?: string;
}

export class Nexure {
  private server: Server;
  private router: Router;
  private middlewares: MiddlewareHandler[] = [];
  private container: Container;
  private logger: Logger;
  private options: NexureOptions;

  constructor(options: NexureOptions = {}) {
    this.options = {
      logging: true,
      prettyJson: false,
      globalPrefix: '',
      ...options
    };

    this.container = new Container();
    this.router = new Router(this.options.globalPrefix);
    this.logger = new Logger(this.options.logging);

    this.server = createServer(this.handleRequest.bind(this));
  }

  /**
   * Register a controller or a module
   * @param target The controller or module to register
   */
  register(target: any): this {
    this.container.register(target);
    this.router.registerRoutes(target, this.container);
    return this;
  }

  /**
   * Add a middleware to the middleware pipeline
   * @param middleware The middleware to add
   */
  use(middleware: MiddlewareHandler): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Start the server
   * @param port The port to listen on
   * @param callback Callback function to execute when the server starts
   */
  listen(port: number, callback?: () => void): Server {
    this.server.listen(port, () => {
      this.logger.info(`Server running at http://localhost:${port}/`);
      if (callback) callback();
    });

    return this.server;
  }

  /**
   * Handle incoming HTTP requests
   * @param req The incoming request
   * @param res The server response
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const startTime = process.hrtime();

    try {
      // Set default headers
      res.setHeader('X-Powered-By', 'NexureJS');
      res.setHeader('Content-Type', 'application/json');

      // Run middleware pipeline
      let middlewareIndex = 0;
      const next = async (): Promise<void> => {
        if (middlewareIndex < this.middlewares.length) {
          const middleware = this.middlewares[middlewareIndex++];
          await middleware(req, res, next);
        } else {
          // Process the route after all middleware has run
          await this.router.process(req, res);
        }
      };

      await next();
    } catch (error) {
      this.handleError(error, req, res);
    } finally {
      // Log request completion
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1000000;
      this.logger.info(`${req.method} ${req.url} - ${res.statusCode} - ${duration.toFixed(2)}ms`);
    }
  }

  /**
   * Handle errors that occur during request processing
   * @param error The error that occurred
   * @param req The incoming request
   * @param res The server response
   */
  private handleError(error: any, req: IncomingMessage, res: ServerResponse): void {
    this.logger.error(`Error processing ${req.method} ${req.url}: ${error.message}`);

    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';

    res.statusCode = statusCode;
    res.end(JSON.stringify({
      statusCode,
      message,
      timestamp: new Date().toISOString(),
      path: req.url
    }, null, this.options.prettyJson ? 2 : 0));
  }
}
