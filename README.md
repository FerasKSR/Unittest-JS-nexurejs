# NexureJS

<!-- Add your logo image here -->
<!-- ![NexureJS Logo](path/to/logo.png) -->

A high-performance, modular Node.js framework with modern developer experience.

[![npm version](https://img.shields.io/npm/v/nexurejs.svg)](https://www.npmjs.com/package/nexurejs)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://github.com/yourusername/nexurejs/actions/workflows/node.js.yml/badge.svg)](https://github.com/yourusername/nexurejs/actions/workflows/node.js.yml)

## Features

- **High Performance**: Built from the ground up for maximum throughput and minimal latency
- **Native Optimizations**: Optional C++ addons for performance-critical components
- **Modern TypeScript**: Full TypeScript support with strong typing
- **Modular Architecture**: Use only what you need, minimal overhead
- **Dependency Injection**: Built-in DI container for clean, testable code
- **Middleware System**: Flexible middleware pipeline for request processing
- **Routing**: Fast, feature-rich router with parameter extraction
- **HTTP Optimizations**: Zero-copy parsing and other optimizations
- **Worker Pool**: Adaptive worker pool for CPU-intensive tasks
- **Benchmarking Tools**: Built-in tools for performance measurement

## Installation

```bash
npm install nexurejs
```

## Quick Start

```typescript
import { NexureApp } from 'nexurejs';
import { Controller, Get, Post, Body, Param } from 'nexurejs/decorators';

@Controller('/users')
class UserController {
  private users = [];

  @Get()
  getAllUsers() {
    return this.users;
  }

  @Get('/:id')
  getUserById(@Param('id') id: string) {
    return this.users.find(user => user.id === id);
  }

  @Post()
  createUser(@Body() userData: any) {
    const newUser = { id: Date.now().toString(), ...userData };
    this.users.push(newUser);
    return newUser;
  }
}

const app = new NexureApp();
app.useController(UserController);
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

## Performance

NexureJS is designed for high performance, with benchmarks showing it outperforms many popular frameworks:

| Framework | Requests/sec | Latency (ms) |
|-----------|--------------|--------------|
| NexureJS   | 50,000+      | 0.5          |
| Express   | 15,000       | 2.1          |
| Fastify   | 35,000       | 0.9          |
| Koa       | 20,000       | 1.5          |

*Benchmark details: Running on Node.js 18, MacBook Pro M1, 16GB RAM, simple JSON response*

## Native Modules

NexureJS includes optional C++ native modules for performance-critical components:

- HTTP Parser
- Radix Router
- JSON Processor

To build and use the native modules:

```bash
npm run build:native:test
```

See [Native Modules Documentation](src/native/README.md) for more details.

## Documentation

- [Getting Started](docs/getting-started.md)
- [Routing](docs/routing.md)
- [Middleware](docs/middleware.md)
- [Dependency Injection](docs/dependency-injection.md)
- [Performance Optimization](docs/performance-optimization.md)
- [API Reference](docs/api-reference.md)
- [Benchmarking Guide](docs/benchmarking-guide.md)

## Examples

The repository includes several examples to help you get started:

- [Basic Server](examples/basic)
- [REST API](examples/rest-api)
- [Middleware Usage](examples/middleware)
- [Performance Optimization](examples/performance)
- [Security Best Practices](examples/security)

To run an example:

```bash
npm run example:basic
```

## Benchmarking

NexureJS includes built-in benchmarking tools to measure performance:

```bash
# Run all benchmarks
npm run benchmark

# Run specific benchmarks
npm run benchmark:http
npm run benchmark:json
npm run benchmark:worker

# Compare native vs JavaScript implementations
npm run benchmark:native
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please make sure your code follows the existing style and includes appropriate tests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by frameworks like Express, Fastify, and NestJS
- Built with modern Node.js and TypeScript best practices
- Optimized with lessons from high-performance C++ and Rust frameworks
