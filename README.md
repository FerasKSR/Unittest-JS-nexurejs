# NexureJS

<p align="center">
  <img src="assets/images/nexurejs-logo.png" alt="NexureJS Logo" width="200" height="200">
</p>

A high-performance, lightweight Node.js framework with native C++ modules for maximum speed.

[![npm version](https://img.shields.io/npm/v/nexurejs.svg)](https://www.npmjs.com/package/nexurejs)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://github.com/nexurejs/nexurejs/actions/workflows/node.js.yml/badge.svg)](https://github.com/nexurejs/nexurejs/actions/workflows/node.js.yml)

## Features

- **High Performance**: Optimized for speed with native C++ modules
- **Lightweight**: Minimal dependencies and small footprint
- **Modern**: Built with TypeScript and modern JavaScript features
- **Flexible**: Modular design allows for easy customization
- **Developer-Friendly**: Clear API and comprehensive documentation

## Native Modules

NexureJS includes native C++ modules for performance-critical operations:

- **HTTP Parser**: Ultra-fast HTTP request parsing
- **Radix Router**: Efficient route matching and parameter extraction
- **JSON Processor**: High-performance JSON parsing and stringification

These native modules can provide up to 10x performance improvement over pure JavaScript implementations. **Native modules are enabled by default** for maximum performance.

## Installation

```bash
npm install nexurejs
```

The installation process will attempt to download pre-built binaries for your platform. If no pre-built binary is available, it will build from source (requires a C++ compiler and node-gyp).

## Quick Start

```javascript
import { createServer } from 'nexurejs';

const app = createServer();

app.get('/', (req, res) => {
  res.send('Hello, NexureJS!');
});

app.get('/users/:id', (req, res) => {
  res.json({ userId: req.params.id, message: 'User details' });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

## Native Module Configuration

You can configure the native modules behavior:

```javascript
import { configureNativeModules } from 'nexurejs/native';

// Configure native modules
configureNativeModules({
  enabled: true,        // Enable/disable all native modules (default: true)
  verbose: false,       // Enable/disable verbose logging (default: false)
  maxCacheSize: 1000    // Maximum size for route cache (default: 1000)
});
```

## Performance Metrics

NexureJS includes built-in performance metrics:

```javascript
import { getAllPerformanceMetrics, resetAllPerformanceMetrics } from 'nexurejs/native';

// Reset metrics before tests
resetAllPerformanceMetrics();

// Run your application...

// Get performance metrics
const metrics = getAllPerformanceMetrics();
console.log(metrics);
```

## Building from Source

If you want to build the native modules from source:

```bash
npm run build:native
```

For development and testing:

```bash
npm run build:native:test
```

## Examples

Check out the examples directory for more usage examples:

- Basic server setup (`npm run example:basic`)
- Middleware usage (`npm run example:middleware`)
- Performance optimization (`npm run example:performance`)
- Native module usage (`npm run example:native`)
- Security best practices (`npm run example:security`)

## Benchmarks

Run benchmarks to compare performance:

```bash
npm run benchmark           # Run all benchmarks
npm run benchmark:http      # HTTP parser benchmark
npm run benchmark:json      # JSON processor benchmark
npm run benchmark:native    # Compare native vs JavaScript implementations
```

## Documentation

For detailed documentation, see the [docs](./docs) directory:

- [Native Modules](./docs/native-modules.md)
- [HTTP Parser](./docs/http-parser.md)
- [Radix Router](./docs/routing.md)
- [JSON Processor](./docs/json-processor.md)

## Requirements

- Node.js 18.0.0 or later
- For building native modules:
  - C++ compiler (GCC, Clang, or MSVC)
  - Python 2.7 or 3.x
  - node-gyp

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## License

MIT

## Acknowledgments

- Inspired by frameworks like Express, Fastify, and NestJS
- Built with modern Node.js and TypeScript best practices
- Optimized with lessons from high-performance C++ and Rust frameworks
