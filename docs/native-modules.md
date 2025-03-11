# NexureJS Native Modules Guide

NexureJS includes high-performance native C++ modules that significantly boost performance for critical operations. This guide explains how to use these modules effectively in your applications.

## Table of Contents

- [Introduction](#introduction)
- [Core Native Modules](#core-native-modules)
  - [HTTP Parser](#http-parser)
  - [Radix Router](#radix-router)
  - [JSON Processor](#json-processor)
- [Enhanced Native Modules](#enhanced-native-modules)
  - [URL Parser](#url-parser)
  - [Schema Validator](#schema-validator)
  - [Compression](#compression)
- [Configuration](#configuration)
- [Performance Monitoring](#performance-monitoring)
- [Troubleshooting](#troubleshooting)

## Introduction

Native modules are written in C++ and provide significant performance advantages over pure JavaScript implementations. NexureJS's native modules are:

- **High-performance**: Often 2-10x faster than equivalent JavaScript code
- **Memory-efficient**: Lower memory footprint and reduced garbage collection pressure
- **CPU-efficient**: Makes better use of CPU resources
- **Resilient**: All modules include JavaScript fallbacks for compatibility

## Core Native Modules

### HTTP Parser

The HTTP parser provides fast, zero-copy parsing of HTTP requests and responses.

```javascript
import { HttpParser } from 'nexurejs/native';

const parser = new HttpParser();
const result = parser.parse(buffer);

console.log(result.method);     // 'GET'
console.log(result.url);        // '/api/users'
console.log(result.statusCode); // 200
console.log(result.headers);    // { 'content-type': 'application/json' }
```

### Radix Router

The radix router provides fast route matching with parameter extraction.

```javascript
import { RadixRouter } from 'nexurejs/native';

const router = new RadixRouter();

// Add routes
router.add('GET', '/users/:id', userHandler);
router.add('POST', '/users', createUserHandler);

// Match a route
const match = router.find('GET', '/users/123');
console.log(match.found);       // true
console.log(match.handler);     // [Function: userHandler]
console.log(match.params);      // { id: '123' }
```

### JSON Processor

The JSON processor provides optimized JSON parsing and stringification.

```javascript
import { JsonProcessor } from 'nexurejs/native';

const processor = new JsonProcessor();

// Parse JSON
const obj = processor.parse('{"name":"NexureJS","version":"1.0.0"}');

// Stringify JSON
const str = processor.stringify({ name: 'NexureJS', version: '1.0.0' });

// Stream parsing for large JSON files
const items = processor.parseStream(largeJsonBuffer);
```

## Enhanced Native Modules

### URL Parser

The URL parser provides fast URL parsing and query string extraction.

```javascript
import { UrlParser } from 'nexurejs/native';

const parser = new UrlParser();

// Parse a URL
const url = parser.parse('https://user:pass@example.com:8080/path?query=value#hash');
console.log(url.protocol);  // 'https'
console.log(url.auth);      // 'user:pass'
console.log(url.hostname);  // 'example.com'
console.log(url.port);      // '8080'
console.log(url.pathname);  // '/path'
console.log(url.search);    // 'query=value'
console.log(url.hash);      // 'hash'

// Parse a query string
const query = parser.parseQueryString('name=John&age=30&active=true');
console.log(query.name);    // 'John'
console.log(query.age);     // '30'
console.log(query.active);  // 'true'
```

#### Performance Benefits

The URL parser typically offers:
- 2-4x faster URL parsing than the built-in URL API
- 3-5x faster query string parsing than URLSearchParams
- Reduced memory usage due to optimized string handling

#### Best Practices

- Use for high-volume URL parsing in HTTP servers
- Especially beneficial for routing middleware
- Great for API gateways and proxies that parse many URLs

### Schema Validator

The schema validator provides high-performance JSON schema validation.

```javascript
import { SchemaValidator } from 'nexurejs/native';

const validator = new SchemaValidator();

// Define a schema
const schema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 3, maxLength: 50 },
    age: { type: 'number', minimum: 0, maximum: 120 },
    email: { type: 'string', pattern: '@' },
    tags: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  required: ['name', 'email']
};

// Validate data against the schema
const result = validator.validate(schema, {
  name: 'John Doe',
  age: 30,
  email: 'john@example.com',
  tags: ['developer', 'nodejs']
});

console.log(result.valid);      // true
console.log(result.errors);     // []

// Validate invalid data
const invalidResult = validator.validate(schema, {
  name: 'Jo', // too short
  age: 150,   // exceeds maximum
  tags: ['developer', 123] // not all strings
});

console.log(invalidResult.valid);      // false
console.log(invalidResult.errors);     // [{ path: '$.name', message: 'String too short' }, ...]
```

#### Performance Benefits

The schema validator typically offers:
- 3-8x faster validation than JavaScript implementations
- Efficient handling of complex nested schemas
- Early termination on validation failures for better performance

#### Best Practices

- Use for validating API requests and responses
- Validate configuration files and user inputs
- Create custom validation rules by extending the schema format

### Compression

The compression module provides high-performance zlib compression and decompression.

```javascript
import { Compression } from 'nexurejs/native';

const compression = new Compression();

// Compress data
const compressed = compression.compress('large text or buffer', 6); // compression level 0-9

// Decompress data
const buffer = compression.decompress(compressed); // returns Buffer

// Decompress to string
const text = compression.decompress(compressed, true); // returns string
```

#### Performance Benefits

The compression module typically offers:
- 2-3x faster compression than Node.js zlib
- 2-4x faster decompression
- More efficient memory usage during compression operations
- Better handling of large data sets

#### Best Practices

- Use for HTTP response compression
- Compress data before storage or transmission
- Optimize file sizes in file storage systems
- Use with streams for large data processing

## Configuration

You can configure the native modules behavior:

```javascript
import { configureNativeModules } from 'nexurejs/native';

// Configure native modules
configureNativeModules({
  enabled: true,        // Enable/disable all native modules
  verbose: false,       // Enable/disable verbose logging
  maxCacheSize: 1000,   // Maximum size for route cache
  modulePath: '/path/to/module' // Override module path (advanced)
});
```

## Performance Monitoring

NexureJS includes built-in performance metrics to help you understand the performance characteristics of the native modules:

```javascript
import {
  getAllPerformanceMetrics,
  resetAllPerformanceMetrics
} from 'nexurejs/native';

// Reset metrics before tests
resetAllPerformanceMetrics();

// Run your application...

// Get performance metrics
const metrics = getAllPerformanceMetrics();
console.log(metrics);

/* Example output:
{
  httpParser: {
    jsTime: 156.32,
    jsCount: 1000,
    nativeTime: 32.45,
    nativeCount: 1000
  },
  // metrics for other modules...
}
*/
```

This helps you:
- Compare native vs JavaScript implementation performance
- Identify bottlenecks in your application
- Optimize usage of native modules

## Troubleshooting

If you encounter issues with native modules:

### Module Loading Issues

```javascript
import { getNativeModuleStatus } from 'nexurejs/native';

const status = getNativeModuleStatus();
console.log(status);

/* Example output:
{
  loaded: true,
  httpParser: true,
  radixRouter: true,
  jsonProcessor: true,
  urlParser: true,
  schemaValidator: true,
  compression: true
}
*/
```

### Fallback to JavaScript

All native modules automatically fall back to JavaScript implementations if they can't be loaded. You can also explicitly disable native modules:

```javascript
import { configureNativeModules } from 'nexurejs/native';

configureNativeModules({ enabled: false });
```

### Common Problems

1. **Module not found**: Ensure you have the correct version of NexureJS installed and the native module binaries are present.

2. **Unsupported platform**: Check if your platform is supported. NexureJS provides pre-built binaries for common platforms.

3. **Build issues**: If building from source, ensure you have the necessary build tools installed (node-gyp, C++ compiler).

4. **Performance issues**: Check your usage patterns and ensure you're using the native modules efficiently.

## Contributing

If you want to contribute to the native modules, see the [Contributing Guide](../CONTRIBUTING.md) for more information.

## License

The native modules are licensed under the MIT License. See the [LICENSE](../LICENSE) file for more information.
