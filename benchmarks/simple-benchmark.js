/**
 * NexureJS Simple Benchmark
 *
 * This is a simple benchmark script that compares the performance of
 * native C++ implementations against pure JavaScript implementations.
 */

const {
  HttpParser,
  RadixRouter,
  JsonProcessor,
  configureNativeModules,
  getNativeModuleStatus,
  resetAllPerformanceMetrics,
  getAllPerformanceMetrics
} = require('../dist/src/native/index.js');

// Configure native modules
configureNativeModules({ verbose: true });

// Check if native modules are available
const status = getNativeModuleStatus();
console.log('Native Module Status:');
console.log(JSON.stringify(status, null, 2));

// Create instances
const httpParser = new HttpParser();
const radixRouter = new RadixRouter();
const jsonProcessor = new JsonProcessor();

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
  { path: '/api/posts/:id/comments', handler: 'getPostCommentsHandler' }
];

// Sample routes to lookup
const sampleLookups = [
  '/api/users',
  '/api/users/123',
  '/api/posts',
  '/api/posts/456',
  '/api/posts/456/comments'
];

// Reset performance metrics
resetAllPerformanceMetrics();

// Run benchmarks
const ITERATIONS = 10000;

console.log(`\nRunning benchmarks with ${ITERATIONS.toLocaleString()} iterations each...`);

// HTTP Parser benchmark
console.log('\n=== HTTP Parser Benchmark ===');
console.time('HTTP Parser');
for (let i = 0; i < ITERATIONS; i++) {
  httpParser.parse(sampleHttpRequest);
}
console.timeEnd('HTTP Parser');

// Radix Router benchmark
console.log('\n=== Radix Router Benchmark ===');

// Add routes
for (const route of sampleRoutes) {
  radixRouter.addRoute(route.path, route.handler);
}

console.time('Radix Router');
for (let i = 0; i < ITERATIONS; i++) {
  for (const path of sampleLookups) {
    radixRouter.findRoute(path);
  }
}
console.timeEnd('Radix Router');

// JSON Processor benchmark
console.log('\n=== JSON Processor Benchmark ===');
const jsonBuffer = Buffer.from(JSON.stringify(sampleJson));

console.time('JSON Parse (Buffer)');
for (let i = 0; i < ITERATIONS; i++) {
  jsonProcessor.parse(jsonBuffer);
}
console.timeEnd('JSON Parse (Buffer)');

console.time('JSON Parse (String)');
const jsonString = JSON.stringify(sampleJson);
for (let i = 0; i < ITERATIONS; i++) {
  jsonProcessor.parseString(jsonString);
}
console.timeEnd('JSON Parse (String)');

console.time('JSON Stringify');
for (let i = 0; i < ITERATIONS; i++) {
  jsonProcessor.stringify(sampleJson);
}
console.timeEnd('JSON Stringify');

// Get performance metrics
console.log('\n=== Performance Metrics ===');
const metrics = getAllPerformanceMetrics();
console.log(JSON.stringify(metrics, null, 2));

// Calculate operations per second
const httpParserTime = metrics.httpParser?.nativeImplementation?.totalTime || 0;
const httpParserOps = metrics.httpParser?.nativeImplementation?.parseOps || 0;
const httpParserOpsPerSec = httpParserOps > 0 ? Math.floor((httpParserOps / httpParserTime) * 1000) : 0;

const radixRouterTime = metrics.radixRouter?.nativeImplementation?.totalTime || 0;
const radixRouterOps = metrics.radixRouter?.nativeImplementation?.findRouteOps || 0;
const radixRouterOpsPerSec = radixRouterOps > 0 ? Math.floor((radixRouterOps / radixRouterTime) * 1000) : 0;

const jsonParseTime = metrics.jsonProcessor?.nativeImplementation?.totalParseTime || 0;
const jsonParseOps = metrics.jsonProcessor?.nativeImplementation?.parseOps || 0;
const jsonParseOpsPerSec = jsonParseOps > 0 ? Math.floor((jsonParseOps / jsonParseTime) * 1000) : 0;

const jsonStringifyTime = metrics.jsonProcessor?.nativeImplementation?.totalStringifyTime || 0;
const jsonStringifyOps = metrics.jsonProcessor?.nativeImplementation?.stringifyOps || 0;
const jsonStringifyOpsPerSec = jsonStringifyOps > 0 ? Math.floor((jsonStringifyOps / jsonStringifyTime) * 1000) : 0;

// Print operations per second
console.log('\n=== Operations Per Second ===');
console.log(`HTTP Parser: ${httpParserOpsPerSec.toLocaleString()} ops/sec`);
console.log(`Radix Router: ${radixRouterOpsPerSec.toLocaleString()} ops/sec`);
console.log(`JSON Parse: ${jsonParseOpsPerSec.toLocaleString()} ops/sec`);
console.log(`JSON Stringify: ${jsonStringifyOpsPerSec.toLocaleString()} ops/sec`);

console.log('\nBenchmark completed successfully!');
