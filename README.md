# NexureJS

A high-performance, modular Node.js framework with modern developer experience.

## Vision

NexureJS combines the ease-of-use from Express, the performance of Fastify, and the advanced features of NestJS, all while aiming for the speed and efficiency akin to Bun.

### Key Features

- **Performance-First**: Optimized for low overhead and fast startup times
- **Modular & Lightweight**: Minimal core with high extensibility
- **Modern Developer Experience**: Built-in TypeScript support, dependency injection, and powerful routing
- **Advanced Security**: Comprehensive security features to protect your applications
- **Scalable Architecture**: Built for multi-core environments with clustering and worker threads

## Installation

```bash
npm install nexurejs
```

## Quick Start

```typescript
import { Nexure, Controller, Get } from 'nexurejs';

@Controller('/hello')
class HelloController {
  @Get('/')
  sayHello() {
    return { message: 'Hello, NexureJS!' };
  }
}

const app = new Nexure();
app.register(HelloController);
app.listen(3000, () => {
  console.log('Server running at http://localhost:3000/');
});
```

## Architecture

NexureJS is built with a focus on:

1. **Minimal Abstraction**: Built on Node.js's native HTTP/HTTPS modules
2. **Fast Parsers**: High-performance JSON and URL parsers
3. **Layered Middleware**: Asynchronous and composable middleware pipeline
4. **Plugin Architecture**: Well-documented API for creating plugins
5. **Declarative & Dynamic Routing**: Flexible, pattern-matching router
6. **TypeScript Integration**: First-class TypeScript support
7. **Dependency Injection**: Lightweight DI system for complex applications

## Performance Features

NexureJS includes several performance optimizations:

- **Native Bindings**: Integration with native modules for performance-critical tasks
- **Caching Strategies**: Built-in caching middleware with support for distributed stores
- **Worker Threads & Clustering**: Support for CPU-intensive operations and multi-core environments
- **HTTP/2 Support**: Native support for HTTP/2 to reduce latency and improve resource utilization
- **Performance Monitoring**: Built-in profiling and benchmarking utilities

```typescript
// Create a performance monitor
const performanceMonitor = new PerformanceMonitor();
performanceMonitor.start();

// Create a cache manager
const cacheManager = new CacheManager();
app.use(createCacheMiddleware(cacheManager));

// Create a cluster manager
const clusterManager = new ClusterManager();
clusterManager.start();
```

## Security Features

NexureJS includes comprehensive security features:

- **Input Validation**: Built-in validation system for request data
- **Security Headers**: Middleware for setting security-related HTTP headers
- **CSRF Protection**: Built-in CSRF tokens and validation
- **Rate Limiting**: Protection against brute force and DoS attacks
- **TLS/SSL Support**: Secure communication with HTTPS and HTTP/2
- **Environment Security**: Safe handling of environment variables and configuration

### CSRF Protection

NexureJS includes built-in CSRF protection middleware that helps prevent Cross-Site Request Forgery attacks. The CSRF protection works by generating a unique token for each user session and validating this token on subsequent requests.

### JWT Authentication

NexureJS provides a comprehensive JWT (JSON Web Token) authentication system that allows you to secure your application with token-based authentication. Features include:

- Token generation with configurable options
- Token verification with comprehensive security checks
- Middleware for protecting routes
- Support for custom token extraction logic
- Role-based access control

Example usage:

```typescript
// Create JWT authentication middleware
const jwtAuth = createJwtAuthMiddleware({
  secret: 'your-secret-key',
  expiresIn: 3600 // 1 hour
});

// Protect routes with JWT authentication
router.get('/protected', jwtAuth, async (req, res) => {
  // Access the authenticated user
  const user = (req as any).user;

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Protected route', user }));
});
```

For more details, see the [JWT Authentication documentation](docs/jwt-authentication.md).

```typescript
// Add security headers middleware
app.use(createSecurityHeadersMiddleware());

// Add CSRF protection middleware
app.use(createCsrfMiddleware());

// Add rate limiting middleware
app.use(createRateLimiterMiddleware());

// Add validation middleware
app.use(validateBody(userSchema));
```

## Benchmarking

NexureJS includes comprehensive benchmarking tools to measure and compare the performance of different components and implementations.

### Running Benchmarks

NexureJS provides multiple ways to run benchmarks:

```bash
# Run all benchmarks
npm run benchmark

# HTTP benchmarks (router and parser)
npm run benchmark:http

# JSON serialization benchmarks
npm run benchmark:json

# Worker pool benchmarks
npm run benchmark:worker

# V8 optimization benchmarks
npm run benchmark:v8

# Simple benchmark (TypeScript version)
npm run benchmark:simple

# Simple benchmark (JavaScript version)
npm run benchmark:simple:js
```

### TypeScript Benchmark Runners

For TypeScript benchmarks, NexureJS provides specialized tools to handle ESM modules:

```bash
# Run TypeScript benchmarks with the dedicated runner
node run-typescript.js benchmarks/http-benchmark.ts

# Use shell scripts on Unix-based systems
./run-ts.sh benchmarks/http-benchmark.ts
./run-ts-bench.sh benchmarks/worker-pool-benchmark.ts
```

### Benchmark Results

Benchmark results are saved to the `benchmark-results` directory in JSON format. Each benchmark run creates its own result file with a timestamp.

The results include:

- Performance metrics (operations per second, average time, etc.)
- Memory usage statistics
- CPU usage statistics
- Percentile distributions (p50, p90, p95, p99)

For more information on benchmarking, see the [Benchmarking Guide](./docs/benchmarking-guide.md).

## Documentation

For full documentation, visit [nexurejs.io](https://nexurejs.io) (coming soon).

For more detailed documentation, see the [docs](./docs) directory.

See [ENHANCEMENTS.md](ENHANCEMENTS.md) for details on performance and security features.

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for more details.

## License

[MIT](LICENSE)
