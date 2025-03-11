# NexureJS API Reference

## Table of Contents

- [Nexure Class](#nexure-class)
- [Controllers](#controllers)
- [Routing](#routing)
- [Middleware](#middleware)
- [Dependency Injection](#dependency-injection)
- [WebSockets](#websockets)
- [Native Modules](#native-modules)
- [Utility Functions](#utility-functions)

## Nexure Class

### Constructor

```typescript
constructor(options: NexureOptions = {})
```

Creates a new Nexure application instance with the specified options.

### Options

```typescript
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
```

### Methods

#### `register(target: any): this`

Registers a controller or provider with the application.

```typescript
app.register(UserController);
```

#### `use(middleware: MiddlewareHandler): this`

Adds a middleware to the application.

```typescript
app.use(new LoggerMiddleware());
```

#### `listen(port: number, callback?: () => void): Server`

Starts the server on the specified port.

```typescript
app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

#### `getWebSocketServer(): NexureWebSocketServer | undefined`

Returns the WebSocket server instance if WebSockets are enabled, or `undefined` otherwise.

```typescript
const wsServer = app.getWebSocketServer();
if (wsServer) {
  wsServer.broadcast({ type: 'message', data: 'Hello' });
}
```

#### `cleanup(): void`

Releases resources used by the application, including memory resources and WebSocket connections.

```typescript
// Clean up when shutting down
process.on('SIGINT', () => {
  app.cleanup();
  process.exit(0);
});
```

## Controllers

### Controller Decorator

```typescript
@Controller(prefix?: string)
```

Marks a class as a controller with an optional route prefix.

```typescript
@Controller('/users')
class UserController {
  // ...
}
```

### Route Decorators

#### `@Get(path?: string)`

Marks a method as a handler for GET requests.

```typescript
@Get('/profile')
getProfile() {
  // ...
}
```

#### `@Post(path?: string)`

Marks a method as a handler for POST requests.

```typescript
@Post()
createUser(@Body() userData: any) {
  // ...
}
```

#### `@Put(path?: string)`

Marks a method as a handler for PUT requests.

```typescript
@Put('/:id')
updateUser(@Param('id') id: string, @Body() userData: any) {
  // ...
}
```

#### `@Patch(path?: string)`

Marks a method as a handler for PATCH requests.

```typescript
@Patch('/:id')
partialUpdateUser(@Param('id') id: string, @Body() userData: any) {
  // ...
}
```

#### `@Delete(path?: string)`

Marks a method as a handler for DELETE requests.

```typescript
@Delete('/:id')
deleteUser(@Param('id') id: string) {
  // ...
}
```

#### `@Head(path?: string)`

Marks a method as a handler for HEAD requests.

```typescript
@Head()
checkUser() {
  // ...
}
```

#### `@Options(path?: string)`

Marks a method as a handler for OPTIONS requests.

```typescript
@Options()
getUserOptions() {
  // ...
}
```

#### `@All(path?: string)`

Marks a method as a handler for all HTTP methods.

```typescript
@All('/any')
handleAny() {
  // ...
}
```

### Parameter Decorators

#### `@Param(name?: string)`

Extracts a route parameter.

```typescript
@Get('/:id')
getUserById(@Param('id') id: string) {
  // ...
}
```

#### `@Query(name?: string)`

Extracts a query parameter.

```typescript
@Get()
searchUsers(@Query('name') name: string) {
  // ...
}
```

#### `@Body()`

Extracts the request body.

```typescript
@Post()
createUser(@Body() userData: any) {
  // ...
}
```

#### `@Header(name: string)`

Extracts a request header.

```typescript
@Get()
getWithAuth(@Header('authorization') auth: string) {
  // ...
}
```

#### `@Req()`

Provides access to the request object.

```typescript
@Get()
getWithRequest(@Req() req: any) {
  // ...
}
```

#### `@Res()`

Provides access to the response object.

```typescript
@Get()
getWithResponse(@Res() res: any) {
  // ...
}
```

## Routing

### Router Class

```typescript
class Router {
  constructor(prefix?: string);

  add(method: HttpMethod, path: string, handler: RouteHandler): this;
  find(method: HttpMethod, path: string): RouteMatch;

  get(path: string, handler: RouteHandler): this;
  post(path: string, handler: RouteHandler): this;
  put(path: string, handler: RouteHandler): this;
  patch(path: string, handler: RouteHandler): this;
  delete(path: string, handler: RouteHandler): this;
  head(path: string, handler: RouteHandler): this;
  options(path: string, handler: RouteHandler): this;
  all(path: string, handler: RouteHandler): this;
}
```

## Middleware

### Creating Middleware

```typescript
@Middleware()
class LoggerMiddleware implements MiddlewareHandler {
  async handle(req: any, res: any, next: () => Promise<void>): Promise<void> {
    console.log(`${req.method} ${req.url}`);
    await next();
    console.log(`Response status: ${res.statusCode}`);
  }
}
```

### Using Middleware

```typescript
// Global middleware
app.use(new LoggerMiddleware());

// Controller-specific middleware
@Controller('/users')
@UseMiddleware(AuthMiddleware)
class UserController {
  // ...
}

// Route-specific middleware
@Post()
@UseMiddleware(ValidationMiddleware)
createUser(@Body() userData: any) {
  // ...
}
```

## Dependency Injection

### Injectable Decorator

```typescript
@Injectable(options?: { scope?: ServiceScope })
```

Marks a class as injectable.

```typescript
@Injectable()
class UserService {
  // ...
}
```

### Service Scopes

```typescript
enum ServiceScope {
  SINGLETON, // One instance for the entire application
  REQUEST,   // New instance for each request
  TRANSIENT  // New instance each time it's injected
}
```

### Inject Decorator

```typescript
@Inject(token: any)
```

Explicitly specifies a dependency to inject.

```typescript
@Injectable()
class UserService {
  constructor(@Inject('CONFIG') private config: any) {
    // ...
  }
}
```

### Optional Decorator

```typescript
@Optional()
```

Marks a dependency as optional.

```typescript
@Injectable()
class UserService {
  constructor(@Optional() private logger?: LoggerService) {
    // ...
  }
}
```

## WebSockets

### WebSocketController Decorator

```typescript
@WebSocketController()
```

Marks a class as a WebSocket controller.

```typescript
@WebSocketController()
class ChatController {
  // ...
}
```

### WebSocket Event Decorators

#### `@OnConnect()`

Marks a method as a handler for new WebSocket connections.

```typescript
@OnConnect()
handleConnection(context: WebSocketContext) {
  // ...
}
```

#### `@OnMessage()`

Marks a method as a handler for incoming WebSocket messages.

```typescript
@OnMessage()
handleMessage(context: WebSocketContext) {
  // ...
}
```

#### `@OnJoinRoom()`

Marks a method as a handler for clients joining a room.

```typescript
@OnJoinRoom()
handleJoinRoom(context: WebSocketContext) {
  // ...
}
```

#### `@OnLeaveRoom()`

Marks a method as a handler for clients leaving a room.

```typescript
@OnLeaveRoom()
handleLeaveRoom(context: WebSocketContext) {
  // ...
}
```

### WebSocket Context

```typescript
interface WebSocketContext {
  connection: WebSocketConnection;
  message?: WebSocketMessage;
  room?: string;
  binary?: Buffer;
}
```

### WebSocket Connection

```typescript
interface WebSocketConnection {
  send(message: string | object): void;
  sendBinary(data: Buffer): void;
  close(code?: number, reason?: string): void;
  joinRoom(roomName: string): void;
  leaveRoom(roomName: string): void;
  leaveAllRooms(): void;
  isInRoom(roomName: string): boolean;
  getRooms(): string[];
  isAlive: boolean;
  data: Record<string, any>;
}
```

### WebSocket Message

```typescript
interface WebSocketMessage {
  type: string;
  data: any;
  room?: string;
}
```

### WebSocket Server

```typescript
class NexureWebSocketServer {
  broadcast(data: any, exclude?: WebSocket | any): Promise<void>;
  broadcastToRoom(roomName: string, data: any, exclude?: WebSocket | any): Promise<void>;
  getRoomSize(roomName: string): number;
  getRooms(): string[];
  getRoomClients(roomName: string): (WebSocket | any)[];
  close(): void;
}
```

## Native Modules

### Native Module Configuration

```typescript
interface NativeModuleOptions {
  /** Whether native modules are enabled (default: true) */
  enabled?: boolean;
  /** Whether to log verbose information (default: false) */
  verbose?: boolean;
  /** Path to the native module (default: auto-detected) */
  modulePath?: string;
  /** Maximum size for route cache (default: 1000) */
  maxCacheSize?: number;
}
```

### Native Module Status

```typescript
interface NativeModuleStatus {
  /** Whether the native module is loaded */
  loaded: boolean;
  /** Whether the HTTP parser is available */
  httpParser: boolean;
  /** Whether the radix router is available */
  radixRouter: boolean;
  /** Whether the JSON processor is available */
  jsonProcessor: boolean;
  /** Whether the URL parser is available */
  urlParser: boolean;
  /** Whether the schema validator is available */
  schemaValidator: boolean;
  /** Whether the compression module is available */
  compression: boolean;
  /** Whether the WebSocket module is available */
  webSocket: boolean;
  /** Error message if loading failed */
  error?: string;
}
```

### Configure Native Modules

```typescript
function configureNativeModules(options: NativeModuleOptions): NativeModuleStatus
```

### Get Native Module Status

```typescript
function getNativeModuleStatus(): NativeModuleStatus
```

### HTTP Parser

```typescript
class HttpParser {
  constructor();
  parse(buffer: Buffer): HttpParseResult;
  parseHeaders(buffer: Buffer): Record<string, string>;
  parseBody(buffer: Buffer, contentLength: number): Buffer;
  reset(): void;

  static getPerformanceMetrics(): { jsTime: number; jsCount: number; nativeTime: number; nativeCount: number };
  static resetPerformanceMetrics(): void;
}
```

### Radix Router

```typescript
class RadixRouter {
  constructor(options?: { maxCacheSize?: number });
  add(method: string, path: string, handler: any): this;
  find(method: string, path: string): RouteMatch;
  remove(method: string, path: string): boolean;

  static getPerformanceMetrics(): { jsTime: number; jsCount: number; nativeTime: number; nativeCount: number };
  static resetPerformanceMetrics(): void;
}
```

### JSON Processor

```typescript
class JsonProcessor {
  constructor();
  parse(json: string | Buffer): any;
  stringify(value: any): string;
  parseStream(buffer: Buffer): any[];
  stringifyStream(values: any[]): string;

  static getPerformanceMetrics(): {
    jsParseTime: number;
    jsParseCount: number;
    jsStringifyTime: number;
    jsStringifyCount: number;
    nativeParseTime: number;
    nativeParseCount: number;
    nativeStringifyTime: number;
    nativeStringifyCount: number;
  };
  static resetPerformanceMetrics(): void;
}
```

### URL Parser

```typescript
class UrlParser {
  constructor();
  parse(url: string): {
    protocol: string;
    auth: string;
    hostname: string;
    port: string;
    pathname: string;
    search: string;
    hash: string;
  };
  parseQueryString(queryString: string): Record<string, string>;

  static getPerformanceMetrics(): { jsTime: number; jsCount: number; nativeTime: number; nativeCount: number };
  static resetPerformanceMetrics(): void;
}
```

### Schema Validator

```typescript
class SchemaValidator {
  constructor();
  validate(schema: object, data: any): { valid: boolean; errors: { path: string; message: string }[] };

  static getPerformanceMetrics(): { jsTime: number; jsCount: number; nativeTime: number; nativeCount: number };
  static resetPerformanceMetrics(): void;
}
```

### Compression

```typescript
class Compression {
  constructor();
  compress(data: Buffer | string, level?: number): Buffer;
  decompress(data: Buffer, asString?: boolean): Buffer | string;

  static getPerformanceMetrics(): {
    jsCompressTime: number;
    jsCompressCount: number;
    nativeCompressTime: number;
    nativeCompressCount: number;
    jsDecompressTime: number;
    jsDecompressCount: number;
    nativeDecompressTime: number;
    nativeDecompressCount: number;
  };
  static resetPerformanceMetrics(): void;
}
```

## Utility Functions

### Reset Performance Metrics

```typescript
function resetAllPerformanceMetrics(): void
```

### Get All Performance Metrics

```typescript
function getAllPerformanceMetrics(): {
  httpParser: ReturnType<typeof HttpParser.getPerformanceMetrics>;
  radixRouter: ReturnType<typeof RadixRouter.getPerformanceMetrics>;
  jsonProcessor: ReturnType<typeof JsonProcessor.getPerformanceMetrics>;
  urlParser: ReturnType<typeof UrlParser.getPerformanceMetrics>;
  schemaValidator: ReturnType<typeof SchemaValidator.getPerformanceMetrics>;
  compression: ReturnType<typeof Compression.getPerformanceMetrics>;
}
```

### Create Benchmark

```typescript
function createBenchmark(name: string): {
  add(name: string, fn: () => void): void;
  run(): Promise<any>;
}
```

### Logger

```typescript
class Logger {
  constructor(name?: string);

  log(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
  verbose(message: string, ...args: any[]): void;
}
```
