import { createServer, Server, IncomingMessage, ServerResponse } from 'node:http';
import { Router } from '../routing/router.js';
import { MiddlewareHandler } from '../middleware/middleware.js';
import { Container } from '../di/container.js';
import { Logger } from '../utils/logger.js';
import { configureNativeModules, getNativeModuleStatus, WebSocketServer, WebSocketServerOptions } from '../native/index.js';
import { getWebSocketHandlers, isWebSocketController, getWebSocketAuthHandler } from '../decorators/websocket-decorators.js';

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

  /**
   * WebSocket options
   */
  websocket?: {
    /**
     * Enable WebSocket support
     * @default true
     */
    enabled?: boolean;

    /**
     * Advanced WebSocket configuration
     */
    config?: WebSocketServerOptions
  };

  /**
   * Performance optimization options
   * @default { nativeModules: true, gcInterval: 0 }
   */
  performance?: {
    /**
     * Enable native modules for performance-critical operations
     * @default true
     */
    nativeModules?: boolean;

    /**
     * Native module configuration
     */
    nativeModuleConfig?: {
      /**
       * Enable verbose logging for native modules
       * @default false
       */
      verbose?: boolean;

      /**
       * Maximum size for route cache
       * @default 1000
       */
      maxCacheSize?: number;
    };

    /**
     * Interval in ms to force garbage collection if available (0 = disabled)
     * @default 0
     */
    gcInterval?: number;

    /**
     * Max memory usage in MB before forced GC (0 = disabled)
     * @default 0
     */
    maxMemoryMB?: number;
  };
}

export class Nexure {
  private server: Server;
  private router: Router;
  private middlewares: MiddlewareHandler[] = [];
  private container: Container;
  private logger: Logger;
  private options: NexureOptions;
  private wsServer?: WebSocketServer;
  private gcTimer: NodeJS.Timeout | null = null;

  constructor(options: NexureOptions = {}) {
    this.options = {
      logging: true,
      prettyJson: false,
      globalPrefix: '',
      websocket: {
        enabled: true
      },
      performance: {
        nativeModules: true,
        nativeModuleConfig: {
          verbose: false,
          maxCacheSize: 1000
        },
        gcInterval: 0,
        maxMemoryMB: 0
      },
      ...options
    };

    // Initialize native modules
    this.initializeNativeModules();

    this.container = new Container();
    this.router = new Router(this.options.globalPrefix);
    this.logger = new Logger(this.options.logging);

    this.server = createServer(this.handleRequest.bind(this));

    // Initialize WebSocket server if enabled
    if (this.options.websocket?.enabled !== false) {
      const nativeStatus = getNativeModuleStatus();
      if (nativeStatus.loaded && nativeStatus.webSocket) {
        // Create WebSocket server with configured options
        this.wsServer = new WebSocketServer(
          this.server,
          this.options.websocket?.config || {}
        );

        // Set up WebSocket controllers
        this.setupWebSocketControllers();

        this.logger.info('Native WebSocket server initialized');
      } else {
        this.logger.warn('Native WebSocket support is not available. WebSocket functionality is disabled.');
      }
    }

    // Setup memory management if enabled
    this.setupMemoryManagement();
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

    // Start WebSocket server if initialized
    this.wsServer?.start();

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

  /**
   * Initialize native modules
   */
  private initializeNativeModules(): void {
    if (this.options.performance?.nativeModules !== false) {
      configureNativeModules({
        enabled: true,
        verbose: !!this.options.logging,
        ...this.options.performance
      });

      const nativeStatus = getNativeModuleStatus();

      if (this.options.logging) {
        this.logger.info(`Native modules loaded: ${nativeStatus.loaded}`);
        if (nativeStatus.loaded) {
          this.logger.debug(`Available native modules: HTTP Parser: ${nativeStatus.httpParser}, Router: ${nativeStatus.radixRouter}, JSON: ${nativeStatus.jsonProcessor}, WebSocket: ${nativeStatus.webSocket}`);
        }
      }
    }
  }

  /**
   * Setup memory management
   */
  private setupMemoryManagement(): void {
    const gcInterval = this.options.performance?.gcInterval || 0;
    const maxMemoryMB = this.options.performance?.maxMemoryMB || 0;

    // Only setup if either option is enabled
    if (gcInterval <= 0 && maxMemoryMB <= 0) return;

    // Check if we can access the garbage collector
    if (global.gc) {
      if (gcInterval > 0) {
        this.gcTimer = setInterval(() => {
          this.checkMemoryUsage();
        }, gcInterval);
      }

      if (this.options.logging) {
        this.logger.info(`Memory management enabled: interval=${gcInterval}ms, maxMemory=${maxMemoryMB}MB`);
      }
    } else if (this.options.logging) {
      this.logger.warn('Memory management options set but garbage collector not available. Run with --expose-gc flag.');
    }
  }

  /**
   * Check memory usage and run garbage collection if needed
   */
  private checkMemoryUsage(): void {
    const maxMemoryMB = this.options.performance?.maxMemoryMB || 0;
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);

    if (maxMemoryMB > 0 && heapUsedMB > maxMemoryMB) {
      if (this.options.logging) {
        this.logger.debug(`Memory threshold exceeded: ${heapUsedMB}MB > ${maxMemoryMB}MB. Running garbage collection.`);
      }
      global.gc?.();
    } else if (this.options.performance?.gcInterval! > 0) {
      // If interval is set, run GC regardless of memory usage
      global.gc?.();
    }
  }

  /**
   * Clean up resources when shutting down
   */
  cleanup(): void {
    // Stop memory management
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }

    // Close WebSocket server if exists
    this.wsServer?.stop();
  }

  /**
   * Get the WebSocket server instance
   * @returns The WebSocket server instance or undefined if WebSocket support is disabled
   */
  getWebSocketServer(): WebSocketServer | undefined {
    return this.wsServer;
  }

  /**
   * Set up WebSocket controllers and their handlers
   * @private
   */
  private setupWebSocketControllers(): void {
    if (!this.wsServer) return;

    // Get all instances registered in the container that are WebSocket controllers
    const controllers = Array.from(this.container.getAllInstances())
      .filter(controller => isWebSocketController(controller.constructor));

    if (controllers.length === 0) {
      this.logger.debug('No WebSocket controllers found');
      return;
    }

    // Configure authentication handler if available
    if (this.options.websocket?.config?.auth?.required) {
      // Find controllers with auth handlers
      const authHandlers = controllers
        .map(controller => ({
          controller,
          handler: getWebSocketAuthHandler(controller.constructor)
        }))
        .filter(item => !!item.handler);

      if (authHandlers.length > 0) {
        // Use the first auth handler found
        const { controller, handler } = authHandlers[0];

        // Configure auth handler using the public method
        this.wsServer.setAuthenticationHandler(async (token, connection) => {
          try {
            // Call the controller's auth handler
            return await handler.call(controller, { token, connection });
          } catch (error) {
            this.logger.error('Error in WebSocket authentication handler:', error);
            return null;
          }
        });

        this.logger.debug('WebSocket authentication handler configured');
      } else {
        this.logger.warn('WebSocket authentication is required but no authentication handler was found');
      }
    }

    // Register event handlers for all controllers
    for (const controller of controllers) {
      const handlers = getWebSocketHandlers(controller.constructor);

      for (const { event, handler } of handlers) {
        this.wsServer.on(event, async (context) => {
          try {
            await handler.call(controller, context);
          } catch (error) {
            this.logger.error(`Error in WebSocket handler for event '${event}':`, error);
          }
        });
      }

      this.logger.debug(`Registered ${handlers.length} WebSocket handlers for controller ${controller.constructor.name}`);
    }
  }
}
