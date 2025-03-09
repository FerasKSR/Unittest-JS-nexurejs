# NexureJS Framework Documentation

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Core Concepts](#core-concepts)
4. [Routing](#routing)
5. [HTTP Request Handling](#http-request-handling)
6. [Middleware](#middleware)
7. [Performance Optimizations](#performance-optimizations)
8. [Concurrency Management](#concurrency-management)
9. [Caching](#caching)
10. [Serialization](#serialization)
11. [Performance Benchmarking](#performance-benchmarking)
12. [Best Practices](#best-practices)
13. [API Reference](#api-reference)

## Introduction

NexureJS is a high-performance, Node.js framework designed to build scalable and efficient server-side applications. It combines the developer-friendly experience similar to NestJS with the raw performance comparable to Fastify, making it an excellent choice for applications where both development velocity and runtime performance are critical.

### Key Features

- **High Performance**: Optimized for speed with advanced algorithmic implementations
- **Developer Friendly**: Intuitive API design and comprehensive documentation
- **Scalable**: Built-in support for multi-core processing and distributed systems
- **Maintainable**: TypeScript support with strong typing throughout the framework
- **Extensible**: Modular design allows for easy integration of custom components

## Getting Started

### Installation

```bash
npm install nexurejs
```

### Creating a Basic Server

```typescript
import { NexureApp } from 'nexurejs';

const app = new NexureApp();

// Define a route
app.get('/hello', (req, res) => {
  res.send('Hello, World!');
});

// Start the server
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
```

### Using TypeScript

NexureJS is built with TypeScript and provides full typing support. Here's an example with controller classes:

```typescript
import { NexureApp, Controller, Get, Post, Body } from 'nexurejs';

interface CreateUserDto {
  name: string;
  email: string;
}

@Controller('/users')
class UserController {
  @Get()
  getAllUsers() {
    return [{ id: 1, name: 'John Doe' }];
  }

  @Get('/:id')
  getUserById(req) {
    return { id: req.params.id, name: 'John Doe' };
  }

  @Post()
  createUser(@Body() createUserDto: CreateUserDto) {
    return { id: Math.floor(Math.random() * 1000), ...createUserDto };
  }
}

const app = new NexureApp();
app.registerController(UserController);
app.listen(3000);
```

## Core Concepts

### Application Structure

NexureJS follows a modular design pattern that encourages separation of concerns:

```
src/
├── controllers/     # Route handlers
├── services/        # Business logic
├── models/          # Data structures
├── middleware/      # Request processing middleware
└── main.ts          # Application entry point
```

### Dependency Injection

NexureJS includes a lightweight dependency injection system:

```typescript
import { Injectable, NexureApp } from 'nexurejs';

@Injectable()
class UserService {
  getUsers() {
    return [{ id: 1, name: 'John' }];
  }
}

@Controller('/users')
class UserController {
  constructor(private userService: UserService) {}

  @Get()
  getUsers() {
    return this.userService.getUsers();
  }
}

const app = new NexureApp();
app.registerService(UserService);
app.registerController(UserController);
app.listen(3000);
```

## Routing

NexureJS includes a highly optimized radix tree router for fast route matching.

### Basic Routing

```typescript
app.get('/users', handler);
app.post('/users', handler);
app.put('/users/:id', handler);
app.delete('/users/:id', handler);
app.patch('/users/:id', handler);
app.options('/users', handler);
app.head('/users', handler);
```

### Route Parameters

```typescript
app.get('/users/:id', (req, res) => {
  const userId = req.params.id;
  res.send(`User ID: ${userId}`);
});
```

### Query Parameters

```typescript
app.get('/search', (req, res) => {
  const query = req.query.q;
  res.send(`Search query: ${query}`);
});
```

### Wildcard Routes

```typescript
app.get('/files/*', (req, res) => {
  const path = req.params[0];
  res.send(`File path: ${path}`);
});
```

### Controllers

```typescript
@Controller('/api/users')
class UserController {
  @Get()
  getAllUsers() {
    // ...
  }

  @Get('/:id')
  getUserById(req) {
    // ...
  }

  @Post()
  createUser(@Body() data) {
    // ...
  }

  @Put('/:id')
  updateUser(req, @Body() data) {
    // ...
  }

  @Delete('/:id')
  deleteUser(req) {
    // ...
  }
}
```

## HTTP Request Handling

NexureJS provides a zero-copy HTTP parser for efficient request processing.

### Request Object

The `Request` object provides access to the HTTP request data:

```typescript
app.get('/api/data', (req, res) => {
  console.log(req.method);      // GET, POST, etc.
  console.log(req.url);         // /api/data
  console.log(req.headers);     // Headers object
  console.log(req.params);      // Route parameters
  console.log(req.query);       // Query parameters
  console.log(req.body);        // Parsed request body
  console.log(req.cookies);     // Parsed cookies
  console.log(req.ip);          // Client IP address
  console.log(req.protocol);    // HTTP or HTTPS
  console.log(req.secure);      // true if HTTPS
});
```

### Response Object

The `Response` object provides methods to send responses:

```typescript
app.get('/api/examples', (req, res) => {
  // Send a basic response
  res.send('Hello, World!');

  // Send JSON
  res.json({ message: 'Hello, World!' });

  // Set status code
  res.status(201).json({ created: true });

  // Set headers
  res.setHeader('Content-Type', 'application/json');

  // Send a file
  res.sendFile('/path/to/file.txt');

  // Redirect
  res.redirect('/new-location');

  // Stream response
  res.stream(someReadableStream);
});
```

## Middleware

Middleware functions process requests before they reach the route handlers.

### Global Middleware

```typescript
// Apply middleware to all routes
app.use(middleware1);
app.use(middleware2);
```

### Route-Specific Middleware

```typescript
// Apply middleware to specific routes
app.get('/protected', authMiddleware, (req, res) => {
  res.send('Protected resource');
});
```

### Controller-Level Middleware

```typescript
@Controller('/users')
@UseMiddleware(authMiddleware)
class UserController {
  // All routes in this controller will use authMiddleware
}
```

### Method-Level Middleware

```typescript
@Controller('/products')
class ProductController {
  @Get()
  getAllProducts() {
    // No middleware needed
  }

  @Post()
  @UseMiddleware(authMiddleware)
  createProduct() {
    // This method uses authMiddleware
  }
}
```

### Built-in Middleware

NexureJS includes several built-in middleware:

```typescript
// Body parsing middleware
app.use(NexureApp.bodyParser());

// CORS middleware
app.use(NexureApp.cors());

// Compression middleware
app.use(NexureApp.compression());

// Static file serving
app.use(NexureApp.static('public'));

// Cookie parsing
app.use(NexureApp.cookieParser());
```

## Performance Optimizations

NexureJS includes several performance optimizations that can be enabled for production environments.

### Optimized Radix Router

The optimized radix router provides faster route lookups using advanced techniques:

```typescript
import { OptimizedRadixRouter } from 'nexurejs';

// Create a new instance with a global prefix (optional)
const router = new OptimizedRadixRouter('/api');

// Add routes
router.addRoute('GET', '/users', userHandler);
router.addRoute('POST', '/users', createUserHandler);

// Find routes
const match = router.findRoute('GET', '/api/users');
if (match) {
  const { route, params } = match;
  // route.handler is the handler function
  // params contains any parameters from the URL
}

// Get router statistics
const stats = router.getStats();
console.log(`Cache hits: ${stats.hits}, Cache misses: ${stats.misses}`);
```

### Zero-Copy HTTP Parser

The zero-copy HTTP parser minimizes memory allocations during request processing:

```typescript
import { ZeroCopyHttpParser } from 'nexurejs';

// Get a parser from the pool
const parser = ZeroCopyHttpParser.getParser();

// Parse HTTP request data
const result = parser.parse(requestBuffer);

console.log(result.method);       // HTTP method
console.log(result.url);          // Request URL
console.log(result.httpVersion);   // HTTP version
console.log(result.headers);      // Headers
console.log(result.body);         // Request body

// Return parser to the pool when done
ZeroCopyHttpParser.releaseParser(parser);
```

### Request and Response Pooling

Reuse request and response objects to reduce garbage collection overhead:

```typescript
import { RequestPool, ResponsePool } from 'nexurejs';

// Create pools
const requestPool = new RequestPool({
  maxSize: 1000,
  enabled: true
});

const responsePool = new ResponsePool({
  maxSize: 1000,
  enabled: true
});

// In your HTTP server handler
function handleRequest(socket) {
  // Acquire objects from pools
  const req = requestPool.acquire();
  const res = responsePool.acquire();

  // Process the request...

  // Return objects to pools when done
  responsePool.release(res);
  requestPool.release(req);
}
```

### V8 Optimizer

Optimize JavaScript code execution with V8-specific optimizations:

```typescript
import { v8Optimizer } from 'nexurejs';

// Optimize a function
const optimizedFn = v8Optimizer.optimizeFunction(myFunction);

// Create an optimized object
const obj = v8Optimizer.createOptimizedObject({
  name: 'John',
  age: 30
});

// Create a fast array
const arr = v8Optimizer.createFastArray<number>(100, 'number');

// Optimize a class
v8Optimizer.optimizeClass(MyClass);

// Create a monomorphic call site
const monomorphicFn = v8Optimizer.createMonomorphicCallSite(myFunction);

// Get optimization statistics
const stats = v8Optimizer.getOptimizationStats();
console.log(stats.heapStatistics);
```

## Concurrency Management

### Adaptive Worker Pool

Manage concurrency with an adaptive worker pool that scales based on system load:

```typescript
import { AdaptiveWorkerPool } from 'nexurejs';

// Create a worker pool
const pool = new AdaptiveWorkerPool({
  minWorkers: 2,
  maxWorkers: 8,
  workerScript: './worker.js'
});

// Execute a task
const task = {
  id: 'task-1',
  type: 'processData',
  data: { items: [1, 2, 3, 4, 5] },
  priority: 1,
  cpuIntensity: 0.8,
  timeout: 5000
};

try {
  const result = await pool.executeTask(task);
  console.log('Task result:', result);
} catch (error) {
  console.error('Task failed:', error);
}

// Listen for events
pool.on('task:completed', (result) => {
  console.log(`Task ${result.taskId} completed in ${result.metrics.executionTime}ms`);
});

pool.on('pool:scaled-up', (newSize, reason) => {
  console.log(`Pool scaled up to ${newSize} workers: ${reason}`);
});

// Get pool status
const status = pool.getStatus();
console.log(`Workers: ${status.workers}, Active: ${status.busy}, Queue size: ${status.queueSize}`);

// Shutdown the pool when done
await pool.shutdown();
```

### Cluster Manager

Utilize all available CPU cores with the cluster manager:

```typescript
import { ClusterManager } from 'nexurejs';

const manager = new ClusterManager({
  workers: 'auto', // Use one worker per CPU core
  restartOnCrash: true
});

// Start workers
manager.start();

// Listen for events
manager.on('worker:online', (worker) => {
  console.log(`Worker ${worker.id} is online`);
});

manager.on('worker:exit', (worker, code) => {
  console.log(`Worker ${worker.id} exited with code ${code}`);
});

// Send message to all workers
manager.broadcast({ type: 'config', data: { timeout: 5000 } });

// Graceful shutdown
process.on('SIGTERM', async () => {
  await manager.shutdown();
  process.exit(0);
});
```

## Caching

NexureJS provides flexible caching mechanisms to improve performance.

### In-Memory Cache

```typescript
import { CacheManager } from 'nexurejs';

const cache = CacheManager.createCache({
  ttl: 60000, // Time to live in ms
  maxItems: 1000 // Maximum items in cache
});

// Set cache value
cache.set('user:1', { id: 1, name: 'John' });

// Get cache value
const user = cache.get('user:1');

// Delete cache value
cache.delete('user:1');

// Clear entire cache
cache.clear();
```

### Cache Middleware

```typescript
import { cacheMiddleware } from 'nexurejs';

// Apply cache to routes
app.get('/api/products', cacheMiddleware({ ttl: 30000 }), getProductsHandler);

// Or with a specific key generator
app.get('/api/users/:id',
  cacheMiddleware({
    ttl: 60000,
    keyGenerator: (req) => `user:${req.params.id}`
  }),
  getUserHandler
);
```

## Serialization

### Streaming JSON Serialization

Process large JSON data efficiently with streaming:

```typescript
import { JsonSerializer, JsonParser } from 'nexurejs';

// Serializing large objects to JSON streams
const serializer = new JsonSerializer({
  indentation: 2, // Pretty print with 2 spaces
  chunkSize: 8192 // 8KB chunks
});

// For a large object
const largeObject = { /* ... */ };

// Serialize to a readable stream
const jsonStream = serializer.serialize(largeObject);

// Pipe to response or file
jsonStream.pipe(res);

// Parsing JSON streams
const parser = new JsonParser();

// Parse from a readable stream
request.pipe(parser);

// Access data as it's parsed
parser.on('value', (value) => {
  console.log('Parsed value:', value);
});

parser.on('error', (err) => {
  console.error('Parse error:', err);
});
```

## Performance Benchmarking

NexureJS includes tools to benchmark your application's performance.

### Individual Benchmarks

```typescript
import { Benchmark } from 'nexurejs';

// Create a benchmark
const benchmark = new Benchmark(
  // Function to benchmark
  () => {
    // Code to measure
    for (let i = 0; i < 1000; i++) {
      Math.sqrt(i);
    }
  },
  // Options
  {
    name: 'Math operations',
    description: 'Measuring 1000 square root calculations',
    iterations: 100,
    warmup: 10,
    collectMemoryStats: true
  }
);

// Run the benchmark
const result = await benchmark.run();

console.log(`Average time: ${result.averageTime}ms`);
console.log(`Operations per second: ${result.opsPerSecond}`);
console.log(`95th percentile: ${result.percentiles.p95}ms`);
```

### Benchmark Suites

```typescript
import { BenchmarkSuite } from 'nexurejs';

// Create a benchmark suite
const suite = new BenchmarkSuite({
  name: 'API Operations',
  description: 'Testing various API operations',
  parallel: false,
  baseOptions: {
    iterations: 50,
    warmup: 5
  }
});

// Add benchmarks
suite.add(
  () => performGetOperation(),
  { name: 'GET /users' }
);

suite.add(
  () => performPostOperation(),
  { name: 'POST /users' }
);

// Run all benchmarks
const results = await suite.run();

// Compare results
const comparison = suite.compareResults('GET /users', 'POST /users', results);
console.log(comparison);

// Save results to file
suite.saveResults(results);
```

### Performance Tracing

```typescript
import { trace } from 'nexurejs';

class UserService {
  @trace
  async getUserById(id: string) {
    // Method will be automatically traced
    return { id, name: 'John Doe' };
  }
}
```

## Best Practices

### Application Structure

- Organize your code by feature rather than by type
- Use controllers for route handling
- Use services for business logic
- Use models for data structures
- Use middleware for cross-cutting concerns

### Performance Optimization

- Enable the optimized radix router for route lookups
- Use the zero-copy HTTP parser for request parsing
- Enable request and response object pooling
- Configure the adaptive worker pool for concurrent processing
- Use streaming serialization for large JSON responses
- Use the cache middleware for frequently accessed data
- Run benchmarks regularly to identify performance bottlenecks

### Error Handling

```typescript
// Global error handler
app.setErrorHandler((err, req, res) => {
  console.error('Application error:', err);

  if (err.statusCode) {
    res.status(err.statusCode).json({
      error: err.message
    });
  } else {
    res.status(500).json({
      error: 'Internal Server Error'
    });
  }
});

// Route-level error handling
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    // Let the global error handler catch this
    throw err;
  }
});
```

### Validation

```typescript
import { validate } from 'nexurejs';

const userSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 3 },
    email: { type: 'string', format: 'email' },
    age: { type: 'number', minimum: 18 }
  },
  required: ['name', 'email']
};

app.post('/api/users', validate(userSchema), (req, res) => {
  // If we reach here, the request body is valid
  const user = req.body;
  res.status(201).json(user);
});
```

### Configuration

```typescript
import { ConfigService } from 'nexurejs';

// Load configuration from environment variables, files, etc.
const config = new ConfigService({
  envFile: '.env',
  defaults: {
    port: 3000,
    database: {
      host: 'localhost',
      port: 5432
    }
  }
});

// Access configuration values
const port = config.get('port');
const dbHost = config.get('database.host');

// Using configuration with the application
const app = new NexureApp({ config });
app.listen(config.get('port'));
```

## API Reference

For detailed API documentation, please refer to the [API Reference](./api-reference.md).

### Core Components

- `NexureApp`: The main application class
- `Controller`: Base decorator for controller classes
- `Get`, `Post`, `Put`, `Delete`, `Patch`: Route method decorators
- `Middleware`: Base class for middleware
- `Body`, `Param`, `Query`: Parameter decorators
- `Injectable`: Dependency injection decorator

### Performance Components

- `OptimizedRadixRouter`: High-performance router
- `ZeroCopyHttpParser`: Efficient HTTP parser
- `RequestPool`, `ResponsePool`: Object pooling
- `AdaptiveWorkerPool`: Dynamic thread pool
- `ClusterManager`: Multi-core processing
- `JsonSerializer`, `JsonParser`: Efficient JSON handling
- `v8Optimizer`: JavaScript optimization utilities
- `Benchmark`, `BenchmarkSuite`: Performance measurement

For more examples and advanced usage, visit the [NexureJS Documentation Website](https://nexurejs.com/docs).
