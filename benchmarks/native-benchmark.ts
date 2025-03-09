/**
 * NexureJS Native Module Benchmark
 *
 * This benchmark compares the performance of native C++ implementations
 * against pure JavaScript implementations for key components:
 * - HTTP Parser
 * - Radix Router
 * - JSON Processor
 */

import { performance } from 'perf_hooks';
import {
  HttpParser as NativeHttpParser,
  RadixRouter as NativeRadixRouter,
  JsonProcessor as NativeJsonProcessor,
  configureNativeModules,
  resetAllPerformanceMetrics,
  getAllPerformanceMetrics
} from '../src/native/index';

import { HttpParser as JsHttpParser } from '../src/http/http-parser';
import { RadixRouter as JsRadixRouter } from '../src/routing/radix-router';

// Enable verbose logging for native modules
configureNativeModules({ verbose: true });

// Sample HTTP request for testing
const sampleHttpRequest = Buffer.from(
  'GET /api/users?page=1 HTTP/1.1\r\n' +
  'Host: example.com\r\n' +
  'User-Agent: Mozilla/5.0\r\n' +
  'Accept: application/json\r\n' +
  'Content-Type: application/json\r\n' +
  'Content-Length: 26\r\n' +
  '\r\n' +
  '{"name":"John","age":30}'
);

// Sample JSON for testing
const sampleJson = {
  users: [
    { id: 1, name: 'John', email: 'john@example.com', active: true },
    { id: 2, name: 'Jane', email: 'jane@example.com', active: false },
    { id: 3, name: 'Bob', email: 'bob@example.com', active: true }
  ],
  pagination: {
    page: 1,
    perPage: 10,
    total: 3,
    totalPages: 1
  },
  meta: {
    timestamp: new Date().toISOString(),
    server: 'NexureJS',
    version: '1.0.0'
  }
};

// Sample routes for testing
const sampleRoutes = [
  { path: '/api/users', handler: 'getUsersHandler' },
  { path: '/api/users/:id', handler: 'getUserHandler' },
  { path: '/api/posts', handler: 'getPostsHandler' },
  { path: '/api/posts/:id', handler: 'getPostHandler' },
  { path: '/api/posts/:id/comments', handler: 'getPostCommentsHandler' },
  { path: '/api/comments', handler: 'getCommentsHandler' },
  { path: '/api/comments/:id', handler: 'getCommentHandler' },
  { path: '/api/auth/login', handler: 'loginHandler' },
  { path: '/api/auth/register', handler: 'registerHandler' },
  { path: '/api/auth/logout', handler: 'logoutHandler' },
  { path: '/api/profile', handler: 'getProfileHandler' },
  { path: '/api/settings', handler: 'getSettingsHandler' },
  { path: '/api/settings/:section', handler: 'getSettingsSectionHandler' },
  { path: '/api/notifications', handler: 'getNotificationsHandler' },
  { path: '/api/search', handler: 'searchHandler' }
];

// Sample routes to lookup
const sampleLookups = [
  '/api/users',
  '/api/users/123',
  '/api/posts',
  '/api/posts/456',
  '/api/posts/456/comments',
  '/api/comments',
  '/api/comments/789',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/profile',
  '/api/settings',
  '/api/settings/account',
  '/api/notifications',
  '/api/search'
];

/**
 * Run a benchmark function multiple times and measure performance
 */
function runBenchmark(name: string, fn: () => void, iterations: number = 10000): number {
  // Warm up
  for (let i = 0; i < 100; i++) {
    fn();
  }

  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    fn();
  }

  const end = performance.now();
  const duration = end - start;
  const opsPerSecond = Math.floor((iterations / duration) * 1000);

  console.log(`${name}: ${opsPerSecond.toLocaleString()} ops/sec (${duration.toFixed(2)}ms for ${iterations.toLocaleString()} iterations)`);

  return opsPerSecond;
}

/**
 * Benchmark HTTP Parser
 */
function benchmarkHttpParser() {
  console.log('\n=== HTTP Parser Benchmark ===');

  // Reset performance metrics
  resetAllPerformanceMetrics();

  // Create parsers
  const nativeParser = new NativeHttpParser();
  const jsParser = new JsHttpParser();

  // Benchmark native implementation
  const nativeOps = runBenchmark('Native HTTP Parser', () => {
    nativeParser.parse(sampleHttpRequest);
  });

  // Benchmark JavaScript implementation
  const jsOps = runBenchmark('JS HTTP Parser', () => {
    jsParser.parse(sampleHttpRequest);
  });

  // Calculate improvement
  const improvement = ((nativeOps - jsOps) / jsOps * 100).toFixed(2);
  console.log(`Native implementation is ${improvement}% faster`);

  // Log performance metrics
  console.log('\nPerformance Metrics:');
  const metrics = getAllPerformanceMetrics();
  console.log(metrics.httpParser);
}

/**
 * Benchmark Radix Router
 */
function benchmarkRadixRouter() {
  console.log('\n=== Radix Router Benchmark ===');

  // Reset performance metrics
  resetAllPerformanceMetrics();

  // Create routers
  const nativeRouter = new NativeRadixRouter();
  const jsRouter = new JsRadixRouter();

  // Add routes
  for (const route of sampleRoutes) {
    nativeRouter.addRoute(route.path, route.handler);
    jsRouter.addRoute(route.path, route.handler);
  }

  // Benchmark native implementation
  const nativeOps = runBenchmark('Native Radix Router', () => {
    for (const path of sampleLookups) {
      nativeRouter.findRoute(path);
    }
  }, 1000);

  // Benchmark JavaScript implementation
  const jsOps = runBenchmark('JS Radix Router', () => {
    for (const path of sampleLookups) {
      jsRouter.findRoute(path);
    }
  }, 1000);

  // Calculate improvement
  const improvement = ((nativeOps - jsOps) / jsOps * 100).toFixed(2);
  console.log(`Native implementation is ${improvement}% faster`);

  // Log performance metrics
  console.log('\nPerformance Metrics:');
  const metrics = getAllPerformanceMetrics();
  console.log(metrics.radixRouter);
}

/**
 * Benchmark JSON Processor
 */
function benchmarkJsonProcessor() {
  console.log('\n=== JSON Processor Benchmark ===');

  // Reset performance metrics
  resetAllPerformanceMetrics();

  // Create JSON processor
  const nativeJson = new NativeJsonProcessor();

  // Prepare JSON string
  const jsonString = JSON.stringify(sampleJson);
  const jsonBuffer = Buffer.from(jsonString);

  // Benchmark native parse implementation
  const nativeParseOps = runBenchmark('Native JSON Parse (Buffer)', () => {
    nativeJson.parse(jsonBuffer);
  });

  // Benchmark native parse string implementation
  const nativeParseStringOps = runBenchmark('Native JSON Parse (String)', () => {
    nativeJson.parseString(jsonString);
  });

  // Benchmark JavaScript parse implementation
  const jsParseOps = runBenchmark('JS JSON.parse', () => {
    JSON.parse(jsonString);
  });

  // Benchmark native stringify implementation
  const nativeStringifyOps = runBenchmark('Native JSON Stringify', () => {
    nativeJson.stringify(sampleJson);
  });

  // Benchmark JavaScript stringify implementation
  const jsStringifyOps = runBenchmark('JS JSON.stringify', () => {
    JSON.stringify(sampleJson);
  });

  // Calculate improvements
  const parseImprovement = ((nativeParseOps - jsParseOps) / jsParseOps * 100).toFixed(2);
  const stringifyImprovement = ((nativeStringifyOps - jsStringifyOps) / jsStringifyOps * 100).toFixed(2);

  console.log(`Native parse implementation is ${parseImprovement}% faster`);
  console.log(`Native stringify implementation is ${stringifyImprovement}% faster`);

  // Log performance metrics
  console.log('\nPerformance Metrics:');
  const metrics = getAllPerformanceMetrics();
  console.log(metrics.jsonProcessor);
}

/**
 * Run all benchmarks
 */
function runAllBenchmarks() {
  console.log('=== NexureJS Native Module Benchmark ===');
  console.log('Comparing native C++ implementations vs pure JavaScript\n');

  benchmarkHttpParser();
  benchmarkRadixRouter();
  benchmarkJsonProcessor();

  console.log('\n=== Benchmark Summary ===');
  console.log('Native modules provide significant performance improvements');
  console.log('See detailed metrics above for each component');
}

// Run the benchmarks
runAllBenchmarks();
