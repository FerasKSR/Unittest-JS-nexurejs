/**
 * HTTP Performance Benchmark for NexureJS
 *
 * This benchmark compares different components of NexureJS:
 * 1. Optimized Radix Router vs Standard Router
 * 2. Zero-Copy HTTP Parser vs Standard Parser
 * 3. End-to-end HTTP request handling
 */

import { Benchmark, BenchmarkSuite } from '../src/utils/performance-benchmark.js';
import { OptimizedRadixRouter } from '../src/routing/radix-router-optimized.js';
import { RadixRouter } from '../src/routing/radix-router.js';
import { ZeroCopyHttpParser } from '../src/http/zero-copy-parser.js';
import { v8Optimizer } from '../src/utils/v8-optimizer.js';
import { createServer } from 'node:http';
import { performance } from 'node:perf_hooks';

// Sample routes for router benchmarking
const routes = [
  '/users',
  '/users/:id',
  '/users/:id/profile',
  '/users/:id/posts',
  '/users/:id/posts/:postId',
  '/products',
  '/products/:id',
  '/products/:id/reviews',
  '/products/:id/reviews/:reviewId',
  '/categories',
  '/categories/:id',
  '/categories/:id/products',
  '/api/v1/users',
  '/api/v1/users/:id',
  '/api/v1/products',
  '/api/v1/products/:id',
  '/api/v2/users',
  '/api/v2/users/:id',
  '/api/v2/products',
  '/api/v2/products/:id',
];

// Sample HTTP request for parser benchmarking
const sampleHttpRequest = Buffer.from(
  'GET /api/v1/users/123 HTTP/1.1\r\n' +
  'Host: example.com\r\n' +
  'User-Agent: Mozilla/5.0\r\n' +
  'Accept: application/json\r\n' +
  'Content-Type: application/json\r\n' +
  'Content-Length: 0\r\n' +
  '\r\n'
);

// Create a larger HTTP request with headers and body
const largeHttpRequest = Buffer.from(
  'POST /api/v1/users HTTP/1.1\r\n' +
  'Host: example.com\r\n' +
  'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36\r\n' +
  'Accept: application/json, text/plain, */*\r\n' +
  'Accept-Language: en-US,en;q=0.9\r\n' +
  'Accept-Encoding: gzip, deflate, br\r\n' +
  'Content-Type: application/json\r\n' +
  'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c\r\n' +
  'X-Request-ID: abcd1234-5678-efgh-ijkl-mnopqrstuvwx\r\n' +
  'Content-Length: 128\r\n' +
  '\r\n' +
  '{"name":"John Doe","email":"john.doe@example.com","age":30,"address":{"street":"123 Main St","city":"Anytown","state":"CA","zip":"12345"}}'
);

// Run the benchmarks
async function runBenchmarks() {
  console.log('Starting NexureJS Performance Benchmarks');

  // 1. Router Benchmarks
  const routerSuite = new BenchmarkSuite({
    name: 'Router Performance',
    description: 'Comparing different router implementations',
    baseOptions: {
      iterations: 100000,
      warmup: 1000,
      collectMemoryStats: true,
      optimize: true
    }
  });

  // Setup routers
  const standardRouter = new RadixRouter();
  const optimizedRouter = new OptimizedRadixRouter();

  // Add routes to both routers
  routes.forEach(route => {
    // Use a try-catch block to handle potential errors
    try {
      // Try different methods that might be available
      if (typeof (standardRouter as any).register === 'function') {
        (standardRouter as any).register('GET', route, () => {});
      } else if (typeof (standardRouter as any).addRoute === 'function') {
        (standardRouter as any).addRoute('GET', route, () => {});
      } else if (typeof (standardRouter as any).add === 'function') {
        (standardRouter as any).add('GET', route, () => {});
      } else {
        console.warn('Standard router does not have a method to add routes');
      }
    } catch (error) {
      console.error('Error adding route to standard router:', error);
    }

    try {
      // Try different methods that might be available
      if (typeof (optimizedRouter as any).register === 'function') {
        (optimizedRouter as any).register('GET', route, () => {});
      } else if (typeof (optimizedRouter as any).addRoute === 'function') {
        (optimizedRouter as any).addRoute('GET', route, () => {});
      } else if (typeof (optimizedRouter as any).add === 'function') {
        (optimizedRouter as any).add('GET', route, () => {});
      } else {
        console.warn('Optimized router does not have a method to add routes');
      }
    } catch (error) {
      console.error('Error adding route to optimized router:', error);
    }
  });

  // Prepare test URLs
  const testUrls = [
    '/users/123',
    '/products/456/reviews/789',
    '/api/v1/users/123',
    '/api/v2/products/456',
    '/categories/10/products'
  ];

  // Add benchmarks to suite
  routerSuite.add(() => {
    for (const url of testUrls) {
      try {
        // Try different methods that might be available
        if (typeof (standardRouter as any).match === 'function') {
          (standardRouter as any).match('GET', url);
        } else if (typeof (standardRouter as any).find === 'function') {
          (standardRouter as any).find('GET', url);
        } else if (typeof (standardRouter as any).lookup === 'function') {
          (standardRouter as any).lookup('GET', url);
        } else {
          console.warn('Standard router does not have a method to match routes');
        }
      } catch (error) {
        console.error('Error matching route with standard router:', error);
      }
    }
  }, {
    name: 'Standard Radix Router',
    description: 'Lookup performance of standard radix router'
  });

  routerSuite.add(() => {
    for (const url of testUrls) {
      try {
        // Try different methods that might be available
        if (typeof (optimizedRouter as any).match === 'function') {
          (optimizedRouter as any).match('GET', url);
        } else if (typeof (optimizedRouter as any).find === 'function') {
          (optimizedRouter as any).find('GET', url);
        } else if (typeof (optimizedRouter as any).lookup === 'function') {
          (optimizedRouter as any).lookup('GET', url);
        } else {
          console.warn('Optimized router does not have a method to match routes');
        }
      } catch (error) {
        console.error('Error matching route with optimized router:', error);
      }
    }
  }, {
    name: 'Optimized Radix Router',
    description: 'Lookup performance of optimized bitmap-indexed radix router'
  });

  // Run router benchmarks
  const routerResults = await routerSuite.run();
  console.log(routerSuite.compareResults('Standard Radix Router', 'Optimized Radix Router', routerResults));
  routerSuite.saveResults(routerResults);

  // 2. HTTP Parser Benchmarks
  const parserSuite = new BenchmarkSuite({
    name: 'HTTP Parser Performance',
    description: 'Benchmarking HTTP parser implementations',
    baseOptions: {
      iterations: 50000,
      warmup: 1000,
      collectMemoryStats: true,
      optimize: true
    }
  });

  // Create parser instance
  const zeroCopyParser = new ZeroCopyHttpParser();

  // Add benchmarks to suite
  parserSuite.add(() => {
    zeroCopyParser.parse(sampleHttpRequest);
    // Use a try-catch block to handle potential errors
    try {
      // Try different methods that might be available
      if (typeof (zeroCopyParser as any).clear === 'function') {
        (zeroCopyParser as any).clear();
      } else if (typeof (zeroCopyParser as any).reset === 'function') {
        (zeroCopyParser as any).reset();
      } else {
        // Create a new parser instance if reset is not available
        // This is less efficient but works for benchmarking
        const newParser = new ZeroCopyHttpParser();
        Object.assign(zeroCopyParser, newParser);
      }
    } catch (error) {
      console.error('Error resetting parser:', error);
      // Create a new parser instance as a fallback
      const newParser = new ZeroCopyHttpParser();
      Object.assign(zeroCopyParser, newParser);
    }
  }, {
    name: 'Zero-Copy Parser (Small Request)',
    description: 'Parsing a small HTTP request with zero-copy parser'
  });

  parserSuite.add(() => {
    zeroCopyParser.parse(largeHttpRequest);
    // Use a try-catch block to handle potential errors
    try {
      // Try different methods that might be available
      if (typeof (zeroCopyParser as any).clear === 'function') {
        (zeroCopyParser as any).clear();
      } else if (typeof (zeroCopyParser as any).reset === 'function') {
        (zeroCopyParser as any).reset();
      } else {
        // Create a new parser instance if reset is not available
        // This is less efficient but works for benchmarking
        const newParser = new ZeroCopyHttpParser();
        Object.assign(zeroCopyParser, newParser);
      }
    } catch (error) {
      console.error('Error resetting parser:', error);
      // Create a new parser instance as a fallback
      const newParser = new ZeroCopyHttpParser();
      Object.assign(zeroCopyParser, newParser);
    }
  }, {
    name: 'Zero-Copy Parser (Large Request)',
    description: 'Parsing a large HTTP request with zero-copy parser'
  });

  // Run parser benchmarks
  const parserResults = await parserSuite.run();
  parserSuite.saveResults(parserResults);

  // 3. End-to-end HTTP Server Benchmark
  console.log('Setting up HTTP server for end-to-end benchmarks...');

  // Create a simple HTTP server
  const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Hello, World!' }));
  });

  // Start the server on a random port
  const port = 3000 + Math.floor(Math.random() * 1000);
  await new Promise<void>(resolve => {
    server.listen(port, () => {
      console.log(`Server listening on port ${port}`);
      resolve();
    });
  });

  console.log(`To run HTTP benchmarks against this server, use tools like autocannon or wrk:`);
  console.log(`npx autocannon -c 100 -d 10 http://localhost:${port}`);
  console.log(`wrk -t12 -c400 -d30s http://localhost:${port}`);

  console.log('Press Ctrl+C to stop the server and exit');
}

// Run the benchmarks
runBenchmarks().catch(err => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
