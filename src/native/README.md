# NexureJS Native Modules

This directory contains C++ native modules for NexureJS that provide performance-critical functionality with optimized implementations.

## Overview

The native modules provide optimized implementations for:

1. **HTTP Parser** - Fast parsing of HTTP requests and responses
2. **Radix Router** - Efficient routing with parameter extraction
3. **JSON Processor** - High-performance JSON parsing and stringification

These modules are designed to be drop-in replacements for their JavaScript counterparts, providing significant performance improvements while maintaining the same API.

## Prerequisites

To build the native modules, you need:

- Node.js 16.x or later
- npm 7.x or later
- Python 2.7 or 3.x (for node-gyp)
- C++ compiler:
  - Windows: Visual Studio Build Tools
  - macOS: Xcode Command Line Tools
  - Linux: GCC and development tools

## Building

### Automatic Build

The easiest way to build the native modules is to use the provided build script:

```bash
npm run build:native:test
```

This script will:
1. Check for required build tools
2. Clean any previous build artifacts
3. Configure node-gyp
4. Build the native modules
5. Test that the modules load correctly

### Manual Build

If you prefer to build manually, you can use the following commands:

```bash
# Install dependencies
npm install node-addon-api node-gyp

# Configure and build
node-gyp configure
node-gyp build
```

The built module will be available at `build/Release/nexurejs_native.node`.

## Usage

The native modules are automatically loaded by the TypeScript interface in `src/native/index.ts`. This interface provides fallbacks to JavaScript implementations if the native modules are not available.

Example usage:

```typescript
import { HttpParser, RadixRouter, JsonProcessor } from '../native';

// Use HTTP Parser
const parser = new HttpParser();
const result = parser.parse(httpBuffer);

// Use Radix Router
const router = new RadixRouter();
router.addRoute('/users/:id', handler);
const match = router.findRoute('/users/123');

// Use JSON Processor
const jsonProcessor = new JsonProcessor();
const parsed = jsonProcessor.parse(jsonString);
const stringified = jsonProcessor.stringify(object);
```

## Benchmarking

To compare the performance of native modules against their JavaScript counterparts, run:

```bash
npm run benchmark:native
```

This will run a series of benchmarks and save the results to the `benchmark-results` directory.

## Troubleshooting

### Module Not Found

If you get an error like `Error: Cannot find module '../build/Release/nexurejs_native'`, it means the native module was not built or could not be loaded. Check that:

1. You have run `npm run build:native` or `node-gyp rebuild`
2. You have all the required build dependencies installed
3. The module was built for the correct architecture and Node.js version

### Build Errors

If you encounter build errors:

1. Make sure you have all the prerequisites installed
2. Check the error message for specific missing dependencies
3. On Windows, ensure you have the correct Visual Studio Build Tools installed
4. On macOS, run `xcode-select --install` to install the Command Line Tools
5. On Linux, install the build-essential package

### Performance Issues

If you're not seeing the expected performance improvements:

1. Make sure you're testing with a release build (`node-gyp build --release`)
2. Check that you're using the native implementation and not the JavaScript fallback
3. Run the benchmarks to compare performance

## Contributing

When contributing to the native modules:

1. Ensure your code compiles on all supported platforms
2. Add appropriate error handling
3. Write tests for new functionality
4. Benchmark your changes to verify performance improvements
5. Document your changes in the code and update this README if necessary

## License

The native modules are part of NexureJS and are licensed under the same terms as the main project.
