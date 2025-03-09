# NexureJS

<p align="center">
  <img src="assets/images/nexurejs-logo.png" alt="NexureJS Logo" width="200" height="200">
</p>

A high-performance, lightweight Node.js framework with native C++ modules for maximum speed.

[![npm version](https://img.shields.io/npm/v/nexurejs.svg)](https://www.npmjs.com/package/nexurejs)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://github.com/yourusername/nexurejs/actions/workflows/node.js.yml/badge.svg)](https://github.com/yourusername/nexurejs/actions/workflows/node.js.yml)

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

These native modules can provide up to 10x performance improvement over pure JavaScript implementations.

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
import { configureNativeModules } from 'nexurejs';

// Configure native modules
configureNativeModules({
  enabled: true,        // Enable/disable all native modules
  verbose: false,       // Enable/disable verbose logging
  httpParser: true,     // Enable/disable HTTP parser
  radixRouter: true,    // Enable/disable Radix router
  jsonProcessor: true,  // Enable/disable JSON processor
  maxCacheSize: 1000    // Maximum size for route cache
});
```

## Performance Metrics

NexureJS includes built-in performance metrics:

```javascript
import { getAllPerformanceMetrics, resetAllPerformanceMetrics } from 'nexurejs';

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

- Basic server setup
- Middleware usage
- Performance optimization
- Native module usage
- Security best practices

## Documentation

For detailed documentation, see the [docs](./docs) directory.

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## License

MIT

## Acknowledgments

- Inspired by frameworks like Express, Fastify, and NestJS
- Built with modern Node.js and TypeScript best practices
- Optimized with lessons from high-performance C++ and Rust frameworks
