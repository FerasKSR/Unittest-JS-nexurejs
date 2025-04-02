# NexureJS

<p align="center">
  <img src="assets/images/nexurejs-logo.png" alt="NexureJS Logo" width="200" height="200">
</p>

A high-performance, lightweight Node.js framework with native C++ modules for maximum speed.

[![npm version](https://img.shields.io/npm/v/nexurejs.svg)](https://www.npmjs.com/package/nexurejs)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Test](https://github.com/nexurejs/nexurejs/actions/workflows/test.yml/badge.svg)](https://github.com/nexurejs/nexurejs/actions/workflows/test.yml)

## Features

NexureJS provides a solid foundation for building high-performance web applications:

- **Fast Routing**: Efficient request routing with support for parameters, wildcards, and complex patterns
- **Middleware System**: Composable middleware for request/response processing
- **Stream Processing**: High-performance stream transformations for request and response bodies
- **Body Parsing**: Advanced body parsing with streaming capability for large uploads
- **Content Negotiation**: Handles content type detection and processing automatically
- **WebSocket Support**: Built-in WebSocket server with room support and authentication
- **Native Modules**: High-performance C++ implementations for critical operations
- **Performance Optimizations**:
  - Optimized buffer management with pooling and recycling
  - Specialized stream processors for different content types
  - Adaptive buffer sizing based on workload
  - Adaptive timeouts for long-running operations
  - Minimal memory usage for maximum throughput
- **Developer Friendly**: Clear APIs with TypeScript support

## Documentation

NexureJS comes with comprehensive documentation to help you get started and make the most of the framework:

- [API Reference](docs/API_REFERENCE.md) - Complete reference of all APIs and features
- [Quick Reference](docs/QUICK_REFERENCE.md) - Code examples for common operations
- [Main Guide](docs/MAIN_GUIDE.md) - Getting started and core concepts
- [Examples Guide](docs/EXAMPLES.md) - Detailed guide to all example applications
- [Technical Guide](docs/TECHNICAL_GUIDE.md) - In-depth look at the internal architecture
- [Performance Optimization Guide](docs/performance-optimization-guide.md) - Tips for maximizing performance

## Installation

```bash
npm install nexurejs
```

The installation process will attempt to download pre-built binaries for your platform. If no pre-built binary is available, it will build from source (requires a C++ compiler and node-gyp).

## Quick Start

```javascript
import { Nexure } from 'nexurejs';

const app = new Nexure();

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

## Native Modules

NexureJS includes native C++ modules for performance-critical operations:

### Core Modules

- **HTTP Parser**: Ultra-fast HTTP request parsing
- **Radix Router**: Efficient route matching and parameter extraction
- **JSON Processor**: High-performance JSON parsing and stringification
- **URL Parser**: Fast URL and query string parsing
- **Schema Validator**: Efficient JSON schema validation
- **Compression**: High-performance zlib compression and decompression
- **WebSocket Server**: High-performance WebSocket server with room support and authentication

These native modules can provide up to 10x performance improvement over pure JavaScript implementations. **Native modules are enabled by default** for maximum performance.

### Configuration

You can configure native modules behavior:

```javascript
import { configureNativeModules } from 'nexurejs';

// Configure native modules
configureNativeModules({
  enabled: true,        // Enable/disable all native modules (default: true)
  verbose: false,       // Enable/disable verbose logging (default: false)
  maxCacheSize: 1000    // Maximum size for route cache (default: 1000)
});
```

## Performance Optimizations

NexureJS includes several performance optimizations:

### Buffer Pooling

```javascript
import { bufferPool } from 'nexurejs';

// Get buffer from pool
const buffer = bufferPool.get(1024); // 1KB buffer

// Return buffer to pool
bufferPool.release(buffer);
```

### Adaptive Features

The framework includes adaptive features that automatically adjust to workload patterns:

- **Adaptive Buffer Sizing**: Dynamically adjusts buffer allocation based on demand
- **Adaptive Timeouts**: Intelligently adjusts timeout durations based on payload size and type
- **Memory Management**: Proactive allocation strategies based on request patterns
- **Performance Monitoring**: Real-time statistics on processing efficiency

## Examples

Check out the examples directory for more usage examples:

- Basic server setup (`examples/basic/`)
- Middleware usage (`examples/basic/middleware-basics.js`)
- Performance optimization (`examples/performance/`)
- Native module usage (`examples/native/`)
- Security best practices (`examples/security/`)

For detailed information on all examples, see the [Examples Guide](docs/EXAMPLES.md).

## Requirements

- Node.js 18.0.0 or later
- For building native modules:
  - C++ compiler (GCC, Clang, or MSVC)
  - Python 2.7 or 3.x
  - node-gyp

### Platform-Specific Requirements

**Windows:**

- Visual Studio Build Tools
- Windows-build-tools (`npm install --global --production windows-build-tools`)

**macOS:**

- Xcode Command Line Tools (`xcode-select --install`)

**Linux:**

- build-essential package (`sudo apt-get install build-essential`)
- Python 3 (`sudo apt-get install python3`)

## Building and Running

NexureJS comes with a streamlined build system for easy development:

```bash
# Install dependencies
npm install

# Build the project (ESM version)
npm run build

# Build both ESM and CJS versions
npm run build:all

# Build everything (ESM + CJS + type declarations)
npm run build:complete

# Run the development server
npm run dev

# Watch for changes and auto-restart
npm run dev:watch

# Run the production server
npm run start
```

## Contributing

For information on contributing to NexureJS, please see the [CONTRIBUTING.md](CONTRIBUTING.md) file.

## License

MIT License - see the [LICENSE](LICENSE) file for details.
