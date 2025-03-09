# NexureJS API Reference

This document provides a comprehensive reference for the NexureJS API.

## Table of Contents

- [Application](#application)
- [Controllers](#controllers)
- [Routing](#routing)
- [Middleware](#middleware)
- [Dependency Injection](#dependency-injection)
- [HTTP](#http)
- [Native Modules](#native-modules)
- [Utilities](#utilities)

## Application

### NexureApp

The main application class that serves as the entry point for your NexureJS application.

```typescript
import { NexureApp } from 'nexurejs';

const app = new NexureApp(options);
```

#### Constructor Options

```typescript
interface NexureAppOptions {
  // Server options
  port?: number;
  host?: string;
  https?: {
    key: string | Buffer;
    cert: string | Buffer;
  };

  // Performance options
  workers?: number;
  maxRequestSize?: number;

  // Router options
  router?: Router;

  // Middleware options
  middleware?: MiddlewareFunction[];

  // Error handling
  errorHandler?: ErrorHandlerFunction;

  // Logging
  logger?: Logger;
}
```

#### Methods

- `listen(port?: number, callback?: () => void): void` - Start the server
- `use(middleware: MiddlewareFunction): this` - Add middleware
- `useController(controller: Constructor): this` - Register a controller
- `useService(service: Constructor | ServiceProvider, scope?: ServiceScope): this` - Register a service
- `useModule(module: Constructor): this` - Register a module
- `get(path: string, ...handlers: RouteHandler[]): this` - Add a GET route
- `post(path: string, ...handlers: RouteHandler[]): this` - Add a POST route
- `put(path: string, ...handlers: RouteHandler[]): this` - Add a PUT route
- `patch(path: string, ...handlers: RouteHandler[]): this` - Add a PATCH route
- `delete(path: string, ...handlers: RouteHandler[]): this` - Add a DELETE route
- `head(path: string, ...handlers: RouteHandler[]): this` - Add a HEAD route
- `options(path: string, ...handlers: RouteHandler[]): this` - Add an OPTIONS route
- `all(path: string, ...handlers: RouteHandler[]): this` - Add a route for all methods
- `route(path: string): Router` - Create a router for a specific path
- `close(): Promise<void>` - Close the server

## Controllers

Controllers handle incoming requests and return responses.

### Controller Decorator

```typescript
import { Controller } from 'nexurejs/decorators';

@Controller('/path')
class MyController {
  // Controller methods
}
```

### Route Decorators

```typescript
import { Get, Post, Put, Patch, Delete, Head, Options, All } from 'nexurejs/decorators';

@Controller('/users')
class UserController {
  @Get()
  getAllUsers() {
    // Handle GET /users
  }

  @Get('/:id')
  getUserById() {
    // Handle GET /users/:id
  }

  @Post()
  createUser() {
    // Handle POST /users
  }

  @Put('/:id')
  updateUser() {
    // Handle PUT /users/:id
  }

  @Patch('/:id')
  partialUpdateUser() {
    // Handle PATCH /users/:id
  }

  @Delete('/:id')
  deleteUser() {
    // Handle DELETE /users/:id
  }

  @Head()
  headUsers() {
    // Handle HEAD /users
  }

  @Options()
  optionsUsers() {
    // Handle OPTIONS /users
  }

  @All('/search')
  search() {
    // Handle all methods for /users/search
  }
}
```

### Parameter Decorators

```typescript
import { Param, Query, Body, Header, Req, Res } from 'nexurejs/decorators';

@Controller('/users')
class UserController {
  @Get('/:id')
  getUserById(@Param('id') id: string) {
    // id contains the value of the :id parameter
  }

  @Get()
  searchUsers(@Query('name') name: string) {
    // name contains the value of the ?name query parameter
  }

  @Post()
  createUser(@Body() userData: any) {
    // userData contains the parsed request body
  }

  @Get()
  getWithHeaders(@Header('authorization') auth: string) {
    // auth contains the value of the Authorization header
  }

  @Get()
  getWithRequest(@Req() req: Request) {
    // req is the request object
  }

  @Get()
  getWithResponse(@Res() res: Response) {
    // res is the response object
  }
}
```

## Routing

### Router

```typescript
import { Router } from 'nexurejs';

const router = new Router();

router.get('/users', (req, res) => {
  // Handle GET /users
});

router.post('/users', (req, res) => {
  // Handle POST /users
});

// Use the router with a prefix
app.use('/api', router);
```

### Route Parameters

```typescript
app.get('/users/:id', (req, res) => {
  const userId = req.params.id;
  // Use userId
});
```

### Route Patterns

```typescript
// Simple route
app.get('/users', handler);

// Route with named parameter
app.get('/users/:id', handler);

// Route with optional parameter
app.get('/users/:id?', handler);

// Route with wildcard
app.get('/files/*', handler);

// Regular expression route
app.get(/^\/users\/(\d+)$/, handler);
```

## Middleware

### Middleware Function

```typescript
const middleware = (req, res, next) => {
  // Do something with req and res
  next(); // Call next to continue to the next middleware
};

// Use middleware
app.use(middleware);
```

### Error-Handling Middleware

```typescript
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({ message: 'Something went wrong!' });
};

// Use error handler
app.use(errorHandler);
```

### Built-in Middleware

```typescript
import { bodyParser, cors, compression, staticFiles } from 'nexurejs/middleware';

// Parse JSON bodies
app.use(bodyParser.json());

// Parse URL-encoded bodies
app.use(bodyParser.urlencoded({ extended: true }));

// Enable CORS
app.use(cors());

// Enable compression
app.use(compression());

// Serve static files
app.use(staticFiles('public'));
```

## Dependency Injection

### Injectable Decorator

```typescript
import { Injectable } from 'nexurejs/decorators';

@Injectable()
class UserService {
  // Service methods
}
```

### Service Scopes

```typescript
import { Injectable, ServiceScope } from 'nexurejs/decorators';

@Injectable({ scope: ServiceScope.REQUEST })
class UserService {
  // Service methods
}
```

### Custom Providers

```typescript
// Class provider
app.useService({
  provide: UserService,
  useClass: CustomUserService
});

// Value provider
app.useService({
  provide: 'CONFIG',
  useValue: {
    apiUrl: 'https://api.example.com'
  }
});

// Factory provider
app.useService({
  provide: DatabaseService,
  useFactory: () => {
    if (process.env.NODE_ENV === 'production') {
      return new ProductionDatabaseService();
    } else {
      return new DevelopmentDatabaseService();
    }
  }
});
```

### Inject Decorator

```typescript
import { Injectable, Inject } from 'nexurejs/decorators';

@Injectable()
class ApiService {
  constructor(@Inject('CONFIG') private config: any) {
    // Use config
  }
}
```

### Optional Decorator

```typescript
import { Injectable, Optional } from 'nexurejs/decorators';

@Injectable()
class UserService {
  constructor(@Optional() private logger?: LoggerService) {
    // Use logger if available
  }
}
```

### Forward Reference

```typescript
import { Injectable, forwardRef, Inject } from 'nexurejs/decorators';

@Injectable()
class ServiceA {
  constructor(@Inject(forwardRef(() => ServiceB)) private serviceB: ServiceB) {
    // Use serviceB
  }
}

@Injectable()
class ServiceB {
  constructor(@Inject(forwardRef(() => ServiceA)) private serviceA: ServiceA) {
    // Use serviceA
  }
}
```

### Module Decorator

```typescript
import { Module } from 'nexurejs/decorators';

@Module({
  controllers: [UserController],
  services: [UserService],
  exports: [UserService]
})
class UserModule {
  // Module methods
}
```

## HTTP

### Request

The request object represents the HTTP request and has properties for the request query string, parameters, body, HTTP headers, and more.

```typescript
interface Request {
  method: string;
  url: string;
  headers: Record<string, string>;
  params: Record<string, string>;
  query: Record<string, string>;
  body: any;
  ip: string;
  path: string;
  hostname: string;
  protocol: string;
  secure: boolean;
  xhr: boolean;

  // Methods
  get(header: string): string | undefined;
  is(type: string): boolean;
}
```

### Response

The response object represents the HTTP response that a NexureJS app sends when it gets an HTTP request.

```typescript
interface Response {
  statusCode: number;
  headersSent: boolean;

  // Methods
  status(code: number): this;
  send(body: any): this;
  json(body: any): this;
  header(name: string, value: string): this;
  type(type: string): this;
  redirect(url: string, status?: number): this;
  cookie(name: string, value: string, options?: CookieOptions): this;
  clearCookie(name: string, options?: CookieOptions): this;
  end(): this;
}
```

## Native Modules

NexureJS includes optional C++ native modules for performance-critical components.

### HTTP Parser

```typescript
import { HttpParser } from 'nexurejs/native';

const parser = new HttpParser();
const result = parser.parse(httpBuffer);

console.log(result.method); // GET, POST, etc.
console.log(result.url); // /path
console.log(result.headers); // { 'content-type': 'application/json', ... }
console.log(result.body); // Buffer or null
```

### Radix Router

```typescript
import { RadixRouter } from 'nexurejs/native';

const router = new RadixRouter();

// Add a route
router.add('GET', '/users/:id', { handler: 'getUserById' });

// Find a route
const match = router.find('GET', '/users/123');

console.log(match.found); // true
console.log(match.handler); // { handler: 'getUserById' }
console.log(match.params); // { id: '123' }
```

### JSON Processor

```typescript
import { JsonProcessor } from 'nexurejs/native';

const processor = new JsonProcessor();

// Parse JSON
const parsed = processor.parse('{"name":"John","age":30}');

// Stringify JSON
const stringified = processor.stringify({ name: 'John', age: 30 });
```

## Utilities

### Logger

```typescript
import { Logger } from 'nexurejs/utils';

const logger = new Logger('MyComponent');

logger.log('This is a log message');
logger.error('This is an error message');
logger.warn('This is a warning message');
logger.debug('This is a debug message');
logger.verbose('This is a verbose message');
```

### Config

```typescript
import { Config } from 'nexurejs/utils';

// Load configuration from environment variables and config files
const config = new Config();

// Get a configuration value
const port = config.get('PORT', 3000); // Default to 3000 if not set

// Get a nested configuration value
const dbHost = config.get('database.host', 'localhost');
```

### Performance Benchmark

```typescript
import { createBenchmark } from 'nexurejs/utils';

// Create a benchmark suite
const suite = createBenchmark('My Benchmark');

// Add benchmark tests
suite.add('Test 1', () => {
  // Code to benchmark
});

suite.add('Test 2', () => {
  // Code to benchmark
});

// Run the benchmark
suite.run().then(results => {
  console.log(results);
});
```

### Worker Pool

```typescript
import { WorkerPool } from 'nexurejs/utils';

// Create a worker pool
const pool = new WorkerPool({
  minWorkers: 2,
  maxWorkers: 8,
  idleTimeout: 60000 // 1 minute
});

// Execute a task in the worker pool
pool.execute((data) => {
  // This runs in a worker thread
  return data.a + data.b;
}, { a: 1, b: 2 }).then(result => {
  console.log(result); // 3
});

// Close the pool when done
pool.close();
```
