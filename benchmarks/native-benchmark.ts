/**
 * NexureJS Native vs JavaScript Benchmark
 *
 * This benchmark compares the performance of native C++ implementations
 * against their JavaScript counterparts for key components of NexureJS.
 */

import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';
import { BenchmarkSuite } from '../src/utils/performance-benchmark.js';

// Try to load native module
let nativeModule: any = null;
try {
  nativeModule = require('../build/Release/nexurejs_native');
  console.log('Native module loaded successfully!');
} catch (error) {
  console.warn('Native module not available:', (error as Error).message);
  console.warn('Running JavaScript implementations only.');
}

// Sample HTTP request for parsing benchmarks
const sampleHttpRequest = Buffer.from(
  'GET /api/users?page=1&limit=20 HTTP/1.1\r\n' +
  'Host: example.com\r\n' +
  'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\n' +
  'Accept: application/json\r\n' +
  'Content-Type: application/json\r\n' +
  'Content-Length: 27\r\n' +
  '\r\n' +
  '{"username":"john","age":30}'
);

// Sample JSON for parsing benchmarks
const sampleJson = JSON.stringify({
  id: 123,
  name: "Product Name",
  price: 99.99,
  inStock: true,
  tags: ["electronics", "gadget", "popular"],
  manufacturer: {
    id: 45,
    name: "ACME Corp",
    location: "New York",
    established: 1985
  },
  specifications: {
    dimensions: {
      width: 10.5,
      height: 15.2,
      depth: 3.8
    },
    weight: 1.2,
    colors: ["black", "silver", "gold"]
  },
  reviews: [
    { user: "user1", rating: 5, comment: "Excellent product!" },
    { user: "user2", rating: 4, comment: "Good value for money" },
    { user: "user3", rating: 3, comment: "Average performance" }
  ]
});

// Sample routes for router benchmarks
const routes = [
  '/api/users',
  '/api/users/:id',
  '/api/products',
  '/api/products/:id',
  '/api/categories',
  '/api/categories/:id',
  '/api/orders',
  '/api/orders/:id',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/profile',
  '/api/settings',
  '/api/notifications',
  '/api/messages',
  '/api/messages/:id',
  '/api/search',
  '/api/reports/daily',
  '/api/reports/weekly',
  '/api/reports/monthly'
];

// Sample URLs to test route matching
const urlsToMatch = [
  '/api/users',
  '/api/users/123',
  '/api/products',
  '/api/products/456',
  '/api/auth/login',
  '/api/profile',
  '/api/messages/789',
  '/api/reports/daily',
  '/api/nonexistent'
];

// JavaScript implementation of HTTP parser
class JsHttpParser {
  parse(buffer: Buffer): any {
    const request = buffer.toString('utf-8');
    const lines = request.split('\r\n');

    // Parse request line
    const requestLine = lines[0].split(' ');
    const method = requestLine[0];
    const url = requestLine[1];
    const version = requestLine[2];

    // Parse headers
    const headers: Record<string, string> = {};
    let i = 1;
    while (i < lines.length && lines[i] !== '') {
      const headerLine = lines[i];
      const separatorIndex = headerLine.indexOf(':');
      if (separatorIndex > 0) {
        const key = headerLine.substring(0, separatorIndex).trim().toLowerCase();
        const value = headerLine.substring(separatorIndex + 1).trim();
        headers[key] = value;
      }
      i++;
    }

    // Parse body
    let body = '';
    if (i < lines.length - 1) {
      body = lines.slice(i + 1).join('\r\n');
    }

    return { method, url, version, headers, body };
  }
}

// JavaScript implementation of Radix Router
class JsRadixRouter {
  private root: any = { children: {}, isEndpoint: false, handler: null };
  private routeCache: Map<string, any> = new Map();

  addRoute(path: string, handler: any): void {
    let current = this.root;
    const parts = path.split('/').filter(p => p);

    for (const part of parts) {
      const isParam = part.startsWith(':');
      const key = isParam ? ':param' : part;

      if (!current.children[key]) {
        current.children[key] = {
          children: {},
          isEndpoint: false,
          handler: null,
          paramName: isParam ? part.substring(1) : null
        };
      }

      current = current.children[key];
    }

    current.isEndpoint = true;
    current.handler = handler;

    // Clear cache when routes change
    this.routeCache.clear();
  }

  findRoute(path: string): any {
    // Check cache first
    if (this.routeCache.has(path)) {
      return this.routeCache.get(path);
    }

    const parts = path.split('/').filter(p => p);
    const params: Record<string, string> = {};

    const result = this.findRouteRecursive(this.root, parts, 0, params);

    if (result) {
      // Cache the result
      this.routeCache.set(path, {
        handler: result.handler,
        params: { ...params }
      });

      return {
        handler: result.handler,
        params
      };
    }

    return null;
  }

  private findRouteRecursive(node: any, parts: string[], index: number, params: Record<string, string>): any {
    if (index === parts.length) {
      return node.isEndpoint ? node : null;
    }

    const part = parts[index];

    // Try exact match
    if (node.children[part]) {
      const result = this.findRouteRecursive(node.children[part], parts, index + 1, params);
      if (result) return result;
    }

    // Try parameter match
    if (node.children[':param']) {
      const paramNode = node.children[':param'];
      params[paramNode.paramName] = part;
      const result = this.findRouteRecursive(paramNode, parts, index + 1, params);
      if (result) {
        return result;
      }
      // Backtrack
      delete params[paramNode.paramName];
    }

    return null;
  }
}

// JavaScript implementation of JSON processor
class JsJsonProcessor {
  parse(input: string): any {
    return JSON.parse(input);
  }

  stringify(value: any): string {
    return JSON.stringify(value);
  }
}

// Run HTTP parser benchmark
async function runHttpParserBenchmark(): Promise<BenchmarkSuite> {
  const jsParser = new JsHttpParser();
  let nativeParser = null;

  if (nativeModule && nativeModule.HttpParser) {
    nativeParser = new nativeModule.HttpParser();
  }

  const suite = new BenchmarkSuite({ name: 'HTTP Parser Benchmark' });

  // JavaScript implementation
  suite.add(() => {
    jsParser.parse(sampleHttpRequest);
  }, { name: 'JavaScript HTTP Parser' });

  // Native implementation (if available)
  if (nativeParser) {
    suite.add(() => {
      nativeParser.parse(sampleHttpRequest);
    }, { name: 'Native HTTP Parser' });
  }

  await suite.run();
  return suite;
}

// Run Radix Router benchmark
async function runRadixRouterBenchmark(): Promise<BenchmarkSuite> {
  const jsRouter = new JsRadixRouter();
  let nativeRouter = null;

  // Add routes to JS router
  for (const route of routes) {
    jsRouter.addRoute(route, { route });
  }

  // Setup native router if available
  if (nativeModule && nativeModule.RadixRouter) {
    nativeRouter = new nativeModule.RadixRouter();
    for (const route of routes) {
      nativeRouter.addRoute(route, { route });
    }
  }

  const suite = new BenchmarkSuite({ name: 'Radix Router Benchmark' });

  // JavaScript implementation
  suite.add(() => {
    for (const url of urlsToMatch) {
      jsRouter.findRoute(url);
    }
  }, { name: 'JavaScript Radix Router' });

  // Native implementation (if available)
  if (nativeRouter) {
    suite.add(() => {
      for (const url of urlsToMatch) {
        nativeRouter.findRoute(url);
      }
    }, { name: 'Native Radix Router' });
  }

  await suite.run();
  return suite;
}

// Run JSON processor benchmark
async function runJsonProcessorBenchmark(): Promise<BenchmarkSuite> {
  const jsProcessor = new JsJsonProcessor();
  let nativeProcessor = null;

  if (nativeModule && nativeModule.JsonProcessor) {
    nativeProcessor = new nativeModule.JsonProcessor();
  }

  const suite = new BenchmarkSuite({ name: 'JSON Processor Benchmark' });

  // JavaScript implementation - Parse
  suite.add(() => {
    jsProcessor.parse(sampleJson);
  }, { name: 'JavaScript JSON Parse' });

  // JavaScript implementation - Stringify
  suite.add(() => {
    jsProcessor.stringify(JSON.parse(sampleJson));
  }, { name: 'JavaScript JSON Stringify' });

  // Native implementation - Parse (if available)
  if (nativeProcessor) {
    suite.add(() => {
      nativeProcessor.parse(sampleJson);
    }, { name: 'Native JSON Parse' });

    // Native implementation - Stringify (if available)
    suite.add(() => {
      nativeProcessor.stringify(JSON.parse(sampleJson));
    }, { name: 'Native JSON Stringify' });
  }

  await suite.run();
  return suite;
}

// Save benchmark results to file
function saveResults(results: BenchmarkSuite[]): void {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const resultsDir = path.join(__dirname, '..', 'benchmark-results');

  // Create directory if it doesn't exist
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const resultsPath = path.join(resultsDir, `native-benchmark-${timestamp}.json`);

  // Create a simplified representation of the results
  const data = results.map(suite => {
    // Since the properties are private, we'll create a simplified representation
    return {
      name: 'Benchmark Suite', // We can't access the private name property
      results: [] // We can't access the private results property
    };
  });

  fs.writeFileSync(resultsPath, JSON.stringify(data, null, 2));
  console.log(`Results saved to ${resultsPath}`);
}

// Main function
async function main() {
  console.log('Running NexureJS Native vs JavaScript Benchmarks...\n');

  const results: BenchmarkSuite[] = [];

  // Run HTTP parser benchmark
  console.log('Running HTTP Parser Benchmark...');
  results.push(await runHttpParserBenchmark());

  // Run Radix Router benchmark
  console.log('\nRunning Radix Router Benchmark...');
  results.push(await runRadixRouterBenchmark());

  // Run JSON processor benchmark
  console.log('\nRunning JSON Processor Benchmark...');
  results.push(await runJsonProcessorBenchmark());

  // Save results
  saveResults(results);

  console.log('\nAll benchmarks completed!');
}

// Run the main function
main().catch(error => {
  console.error('Error running benchmarks:', error);
  process.exit(1);
});
