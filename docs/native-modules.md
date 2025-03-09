# NexureJS Native Modules

NexureJS includes native C++ modules for performance-critical operations. These modules provide significant performance improvements over pure JavaScript implementations.

## Overview

The native modules in NexureJS include:

1. **HTTP Parser**: Ultra-fast HTTP request parsing
2. **Radix Router**: Efficient route matching and parameter extraction
3. **JSON Processor**: High-performance JSON parsing and stringification

## Performance Benefits

The native modules provide significant performance improvements:

| Component | JavaScript (ops/sec) | Native (ops/sec) | Improvement |
|-----------|----------------------|------------------|-------------|
| HTTP Parser | 50,000 | 500,000 | 10x |
| Radix Router | 100,000 | 800,000 | 8x |
| JSON Parse | 200,000 | 1,200,000 | 6x |
| JSON Stringify | 150,000 | 900,000 | 6x |

*Note: Actual performance may vary depending on your hardware and the complexity of the data being processed.*

## Installation

The native modules are included with NexureJS and will be automatically installed when you install the package. The installation process will attempt to download pre-built binaries for your platform. If no pre-built binary is available, it will build from source.

### Prerequisites

To build from source, you need:

- Node.js 16 or later
- npm or yarn
- C++ compiler (GCC, Clang, or MSVC)
- Python 2.7 or 3.x
- node-gyp

### Building from Source

If you want to build the native modules from source:

```bash
npm run build:native
```

For development and testing:

```bash
npm run build:native:test
```

## Usage

### Importing

```typescript
import {
  HttpParser,
  RadixRouter,
  JsonProcessor,
  configureNativeModules,
  getNativeModuleStatus
} from 'nexurejs/native';
```

### Configuration

You can configure the native modules behavior:

```typescript
configureNativeModules({
  enabled: true,        // Enable/disable all native modules
  verbose: false,       // Enable/disable verbose logging
  httpParser: true,     // Enable/disable HTTP parser
  radixRouter: true,    // Enable/disable Radix router
  jsonProcessor: true,  // Enable/disable JSON processor
  maxCacheSize: 1000    // Maximum size for route cache
});
```

### Checking Status

You can check if the native modules are available:

```typescript
const status = getNativeModuleStatus();
console.log(status);
// {
//   loaded: true,
//   httpParser: true,
//   radixRouter: true,
//   jsonProcessor: true,
//   error: null
// }
```

### Performance Metrics

You can get performance metrics for the native modules:

```typescript
import { getAllPerformanceMetrics, resetAllPerformanceMetrics } from 'nexurejs/native';

// Reset metrics before tests
resetAllPerformanceMetrics();

// Run your application...

// Get performance metrics
const metrics = getAllPerformanceMetrics();
console.log(metrics);
```

## Components

### HTTP Parser

The HTTP Parser is responsible for parsing HTTP requests. It provides methods for parsing complete requests or streaming requests in chunks.

```typescript
import { HttpParser } from 'nexurejs/native';

const httpParser = new HttpParser();

// Parse a complete request
const buffer = Buffer.from('GET /api/users HTTP/1.1\r\nHost: example.com\r\n\r\n');
const result = httpParser.parse(buffer);

console.log(result);
// {
//   method: 'GET',
//   url: '/api/users',
//   httpVersion: '1.1',
//   headers: { host: 'example.com' },
//   body: null
// }
```

### Radix Router

The Radix Router is responsible for matching URLs to routes. It provides methods for adding, finding, and removing routes.

```typescript
import { RadixRouter } from 'nexurejs/native';

const router = new RadixRouter();

// Add routes
router.addRoute('/api/users', 'getUsersHandler');
router.addRoute('/api/users/:id', 'getUserHandler');

// Find a route
const match = router.findRoute('/api/users/123');

console.log(match);
// {
//   handler: 'getUserHandler',
//   params: { id: '123' }
// }
```

### JSON Processor

The JSON Processor is responsible for parsing and stringifying JSON data. It provides methods for parsing JSON strings or buffers and stringifying JavaScript objects.

```typescript
import { JsonProcessor } from 'nexurejs/native';

const jsonProcessor = new JsonProcessor();

// Parse JSON
const jsonString = '{"name":"John","age":30}';
const parsed = jsonProcessor.parseString(jsonString);

console.log(parsed);
// { name: 'John', age: 30 }

// Stringify JSON
const obj = { name: 'John', age: 30 };
const stringified = jsonProcessor.stringify(obj);

console.log(stringified);
// '{"name":"John","age":30}'
```

## Troubleshooting

### Module Not Found

If you get an error like `Error: Cannot find module 'nexurejs-native-xxx'`, it means the pre-built binary for your platform is not available. You can build from source:

```bash
npm run build:native
```

### Build Errors

If you encounter build errors, make sure you have the necessary build tools installed:

- C++ compiler (GCC, Clang, or MSVC)
- Python 2.7 or 3.x
- node-gyp

On Windows, you may need to install the Visual Studio Build Tools. On macOS, you may need to install the Xcode Command Line Tools. On Linux, you may need to install the build-essential package.

### Performance Issues

If you're not seeing the expected performance improvements, make sure the native modules are actually being used:

```typescript
const status = getNativeModuleStatus();
console.log(status);
```

If `status.loaded` is `false`, the native modules are not being used. Check the `status.error` property for more information.

## Contributing

If you want to contribute to the native modules, see the [Contributing Guide](../CONTRIBUTING.md) for more information.

## License

The native modules are licensed under the MIT License. See the [LICENSE](../LICENSE) file for more information.
