# NexureJS Technical Guide

## Table of Contents

- [Performance Optimizations](#performance-optimizations)
  - [Native Modules](#native-modules)
  - [Memory Management](#memory-management)
  - [HTTP Optimization](#http-optimization)
  - [JSON Processing](#json-processing)
  - [WebSocket Performance](#websocket-performance)
- [Native Module Reference](#native-module-reference)
  - [HTTP Parser](#http-parser)
  - [Radix Router](#radix-router)
  - [JSON Processor](#json-processor)
  - [URL Parser](#url-parser)
  - [Schema Validator](#schema-validator)
  - [Compression](#compression)
  - [WebSocket](#websocket)
- [Benchmarking](#benchmarking)
  - [Running Benchmarks](#running-benchmarks)
  - [Interpreting Results](#interpreting-results)
  - [Performance Optimization Tips](#performance-optimization-tips)

## Performance Optimizations

NexureJS is built with performance as a core principle. The framework provides several mechanisms to ensure high performance even under significant load.

### Native Modules

NexureJS leverages C++ native modules for performance-critical operations. These modules are significantly faster than pure JavaScript implementations and are automatically used when available.

#### Enabling Native Modules

Native modules are enabled by default but can be configured:

```typescript
import { Nexure } from 'nexurejs';

const app = new Nexure({
  performance: {
    nativeModules: true, // Enable/disable all native modules
    nativeModuleConfig: {
      verbose: true,     // Log detailed information
      maxCacheSize: 2000 // Set maximum cache size for route cache
    }
  }
});
```

#### Checking Native Module Status

You can check which native modules are available at runtime:

```typescript
import { getNativeModuleStatus } from 'nexurejs/native';

const status = getNativeModuleStatus();
console.log(`Native modules loaded: ${status.loaded}`);
console.log(`HTTP Parser: ${status.httpParser}`);
console.log(`Radix Router: ${status.radixRouter}`);
console.log(`JSON Processor: ${status.jsonProcessor}`);
console.log(`URL Parser: ${status.urlParser}`);
console.log(`Schema Validator: ${status.schemaValidator}`);
console.log(`Compression: ${status.compression}`);
console.log(`WebSocket: ${status.webSocket}`);
```

#### Fallback Mechanism

All native modules have a JavaScript fallback implementation that is automatically used if the native module is not available. This ensures that your application works in all environments, albeit with potentially lower performance.

### Memory Management

NexureJS includes a memory management system to control memory usage and reduce the risk of memory leaks.

#### Garbage Collection Control

You can configure garbage collection behavior:

```typescript
const app = new Nexure({
  performance: {
    gcInterval: 60000,    // Run garbage collection every 60 seconds
    maxMemoryMB: 1024     // Run garbage collection if memory exceeds 1GB
  }
});
```

> **Note:** To enable garbage collection control, you must run Node.js with the `--expose-gc` flag:
> ```bash
> node --expose-gc server.js
> ```

#### Memory Management API

The `Nexure` class provides methods to manage memory:

```typescript
// Clean up resources when shutting down
app.cleanup();
```

#### Resource Cleanup

It's important to clean up resources when your application shuts down:

```typescript
// Clean up when the process is terminated
process.on('SIGINT', () => {
  console.log('Shutting down...');
  app.cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  app.cleanup();
  process.exit(0);
});
```

### HTTP Optimization

NexureJS includes several optimizations for HTTP request handling:

#### Request Parsing

The native HTTP parser is significantly faster than the JavaScript implementation:

```typescript
// The HTTP parser is automatically used when processing requests
// No additional configuration is needed
```

#### Routing Performance

The Radix Router provides fast URL pattern matching:

```typescript
// Routes are automatically optimized using the Radix Router
// You can increase the route cache size for better performance with many routes
const app = new Nexure({
  performance: {
    nativeModuleConfig: {
      maxCacheSize: 5000 // Increase from default 1000
    }
  }
});
```

#### Response Optimization

NexureJS includes several response optimizations:

```typescript
// Disable pretty JSON in production for better performance
const app = new Nexure({
  prettyJson: process.env.NODE_ENV !== 'production'
});
```

### JSON Processing

The native JSON processor provides fast serialization and deserialization:

```typescript
import { JsonProcessor } from 'nexurejs/native';

const processor = new JsonProcessor();

// Parse JSON
const obj = processor.parse('{"name":"John","age":30}');

// Stringify JSON
const json = processor.stringify({ name: 'John', age: 30 });
```

### WebSocket Performance

The WebSocket implementation has been optimized for high-performance real-time applications.

#### Native WebSocket Implementation

When native modules are enabled, NexureJS uses a C++ implementation of WebSockets for improved performance:

- Lower latency
- Higher throughput
- Reduced CPU usage
- Lower memory footprint

#### Message Caching

The WebSocket server includes a message cache to reduce serialization overhead:

```typescript
// Configure WebSocket server
const app = new Nexure({
  websocket: {
    enabled: true  // WebSockets are enabled by default
  }
});
```

## Native Module Reference

### HTTP Parser

The HTTP Parser module provides high-performance parsing of HTTP requests.

#### Features

- Fast HTTP header parsing
- Efficient body extraction
- Support for all HTTP methods
- Header normalization

#### Usage

```typescript
import { HttpParser } from 'nexurejs/native';

const parser = new HttpParser();
const result = parser.parse(buffer);

console.log(result.method);  // GET, POST, etc.
console.log(result.url);     // /path
console.log(result.headers); // { 'content-type': 'application/json', ... }
console.log(result.body);    // Buffer containing the request body
```

#### Performance Metrics

You can check performance metrics:

```typescript
import { HttpParser } from 'nexurejs/native';

const metrics = HttpParser.getPerformanceMetrics();
console.log(`JS parsing: ${metrics.jsCount} requests in ${metrics.jsTime}ms`);
console.log(`Native parsing: ${metrics.nativeCount} requests in ${metrics.nativeTime}ms`);
```

### Radix Router

The Radix Router provides fast URL pattern matching for routing.

#### Features

- Fast URL pattern matching
- Parameter extraction
- Route caching
- Support for complex route patterns

#### Usage

```typescript
import { RadixRouter } from 'nexurejs/native';

const router = new RadixRouter({ maxCacheSize: 1000 });

// Add routes
router.add('GET', '/users', handlerForAllUsers);
router.add('GET', '/users/:id', handlerForSingleUser);
router.add('POST', '/users', handlerForCreateUser);

// Find a handler for a request
const result = router.find('GET', '/users/123');
console.log(result.found);    // true
console.log(result.handler);  // handlerForSingleUser
console.log(result.params);   // { id: '123' }
```

#### Performance Metrics

```typescript
import { RadixRouter } from 'nexurejs/native';

const metrics = RadixRouter.getPerformanceMetrics();
console.log(`JS routing: ${metrics.jsCount} lookups in ${metrics.jsTime}ms`);
console.log(`Native routing: ${metrics.nativeCount} lookups in ${metrics.nativeTime}ms`);
```

### JSON Processor

The JSON Processor provides high-performance JSON parsing and serialization.

#### Features

- Fast JSON parsing
- Efficient serialization
- Stream processing
- Error handling

#### Usage

```typescript
import { JsonProcessor } from 'nexurejs/native';

const processor = new JsonProcessor();

// Parse JSON
const obj = processor.parse('{"name":"John","age":30}');

// Stringify JSON
const json = processor.stringify({ name: 'John', age: 30 });

// Parse JSON stream
const objects = processor.parseStream(buffer);

// Stringify array as stream
const jsonStream = processor.stringifyStream(objects);
```

#### Performance Metrics

```typescript
import { JsonProcessor } from 'nexurejs/native';

const metrics = JsonProcessor.getPerformanceMetrics();
console.log(`JS parsing: ${metrics.jsParseCount} operations in ${metrics.jsParseTime}ms`);
console.log(`Native parsing: ${metrics.nativeParseCount} operations in ${metrics.nativeParseTime}ms`);
console.log(`JS stringify: ${metrics.jsStringifyCount} operations in ${metrics.jsStringifyTime}ms`);
console.log(`Native stringify: ${metrics.nativeStringifyCount} operations in ${metrics.nativeStringifyTime}ms`);
```

### URL Parser

The URL Parser provides efficient URL parsing.

#### Features

- Fast URL parsing
- Query string parsing
- URL normalization
- Protocol, host, path extraction

#### Usage

```typescript
import { UrlParser } from 'nexurejs/native';

const parser = new UrlParser();

// Parse URL
const url = parser.parse('https://example.com/path?query=value#hash');
console.log(url.protocol); // https
console.log(url.hostname); // example.com
console.log(url.pathname); // /path
console.log(url.search);   // ?query=value
console.log(url.hash);     // #hash

// Parse query string
const query = parser.parseQueryString('name=John&age=30');
console.log(query.name); // John
console.log(query.age);  // 30
```

#### Performance Metrics

```typescript
import { UrlParser } from 'nexurejs/native';

const metrics = UrlParser.getPerformanceMetrics();
console.log(`JS parsing: ${metrics.jsCount} operations in ${metrics.jsTime}ms`);
console.log(`Native parsing: ${metrics.nativeCount} operations in ${metrics.nativeTime}ms`);
```

### Schema Validator

The Schema Validator provides fast JSON schema validation.

#### Features

- JSON Schema validation
- Custom error messages
- Path reporting for errors
- Performance optimized

#### Usage

```typescript
import { SchemaValidator } from 'nexurejs/native';

const validator = new SchemaValidator();

// Define a schema
const schema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 3 },
    age: { type: 'number', minimum: 18 }
  },
  required: ['name', 'age']
};

// Validate data against the schema
const result = validator.validate(schema, { name: 'John', age: 30 });
console.log(result.valid);  // true
console.log(result.errors); // []

// Invalid data
const invalidResult = validator.validate(schema, { name: 'Jo', age: 17 });
console.log(invalidResult.valid);  // false
console.log(invalidResult.errors); // [{ path: 'name', message: '...' }, { path: 'age', message: '...' }]
```

#### Performance Metrics

```typescript
import { SchemaValidator } from 'nexurejs/native';

const metrics = SchemaValidator.getPerformanceMetrics();
console.log(`JS validation: ${metrics.jsCount} operations in ${metrics.jsTime}ms`);
console.log(`Native validation: ${metrics.nativeCount} operations in ${metrics.nativeTime}ms`);
```

### Compression

The Compression module provides fast data compression and decompression.

#### Features

- Fast compression
- Efficient decompression
- Configurable compression level
- Binary and string support

#### Usage

```typescript
import { Compression } from 'nexurejs/native';

const compression = new Compression();

// Compress data
const compressed = compression.compress('Hello, world!', 6); // Level 6 compression

// Decompress data
const decompressed = compression.decompress(compressed, true); // Return as string
console.log(decompressed); // Hello, world!
```

#### Performance Metrics

```typescript
import { Compression } from 'nexurejs/native';

const metrics = Compression.getPerformanceMetrics();
console.log(`JS compression: ${metrics.jsCompressCount} operations in ${metrics.jsCompressTime}ms`);
console.log(`Native compression: ${metrics.nativeCompressCount} operations in ${metrics.nativeCompressTime}ms`);
console.log(`JS decompression: ${metrics.jsDecompressCount} operations in ${metrics.jsDecompressTime}ms`);
console.log(`Native decompression: ${metrics.nativeDecompressCount} operations in ${metrics.nativeDecompressTime}ms`);
```

### WebSocket

The WebSocket module provides high-performance WebSocket server capabilities.

#### Features

- Fast message processing
- Room-based messaging
- Binary message support
- Heartbeat mechanism
- Automatic reconnection

#### Usage

Through the Nexure class:

```typescript
import { Nexure } from 'nexurejs';

const app = new Nexure({
  websocket: {
    enabled: true
  }
});

// Get WebSocket server instance
const wsServer = app.getWebSocketServer();

// Broadcast to all clients
wsServer?.broadcast({ type: 'message', data: 'Hello' });

// Broadcast to a specific room
wsServer?.broadcastToRoom('room1', { type: 'message', data: 'Hello room' });
```

## Benchmarking

NexureJS includes benchmarking tools to measure and optimize performance.

### Running Benchmarks

#### Built-in Benchmarks

NexureJS includes several built-in benchmarks:

```bash
# Run all benchmarks
npm run benchmark

# Run specific benchmarks
npm run benchmark:http
npm run benchmark:json
npm run benchmark:worker
npm run benchmark:v8
npm run benchmark:native
```

#### Custom Benchmarks

You can create custom benchmarks:

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

### Interpreting Results

Benchmark results include:

- **Operations per second**: Higher is better
- **Average time per operation**: Lower is better
- **Margin of error**: Lower indicates more reliable results
- **Sample size**: Higher indicates more reliable results

Example:

```
Benchmark: HTTP Parser
  JS Implementation: 45,678 ops/sec ±1.23% (1000 runs sampled)
  Native Implementation: 234,567 ops/sec ±0.89% (1000 runs sampled)
  Native is 5.14x faster
```

### Performance Optimization Tips

#### Route Optimization

- Use specific routes instead of wildcards
- Place most frequently accessed routes first
- Use route parameters judiciously

#### Middleware Optimization

- Minimize the number of global middleware
- Use route-specific middleware when possible
- Optimize expensive operations in middleware

#### Database Optimization

- Use connection pooling
- Implement caching for frequently accessed data
- Optimize queries with proper indexes

#### Response Optimization

- Use compression for large responses
- Minimize serialization overhead
- Stream large responses

#### WebSocket Optimization

- Use room-based messaging instead of broadcasting to all clients
- Batch messages when possible
- Use binary messages for performance-critical applications

#### Memory Usage

- Monitor memory usage with `process.memoryUsage()`
- Implement proper cleanup of resources
- Consider using the NexureJS memory management system
