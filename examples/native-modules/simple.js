/**
 * NexureJS Native Modules Simple Example
 *
 * This example demonstrates how to use the native modules directly.
 * It's a simpler version that works with the compiled JavaScript files.
 */

const {
  HttpParser,
  RadixRouter,
  JsonProcessor,
  configureNativeModules,
  getNativeModuleStatus,
  resetAllPerformanceMetrics,
  getAllPerformanceMetrics
} = require('../../dist/src/native/index.js');

const { HttpStreamParser } = require('../../dist/src/http/http-parser.js');

// Configure native modules with verbose logging
configureNativeModules({ verbose: true });

// Check native module status
const status = getNativeModuleStatus();
console.log('Native Module Status:');
console.log(JSON.stringify(status, null, 2));

// Create instances
const httpParser = new HttpParser();
const streamParser = new HttpStreamParser();
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

// Create a dummy handler function
const dummyHandler = (req, res) => {
  return { success: true };
};

// Reset performance metrics
resetAllPerformanceMetrics();

// Test HTTP Parser
console.log('\n=== HTTP Parser Test ===');
console.time('HTTP Parser');
const parseResult = httpParser.parse(sampleHttpRequest);
console.timeEnd('HTTP Parser');
console.log('Parse Result:');
console.log(JSON.stringify(parseResult, null, 2));

// Test HTTP Stream Parser
console.log('\n=== HTTP Stream Parser Test ===');
console.time('HTTP Stream Parser');
// Process the request in chunks to simulate streaming
const chunk1 = sampleHttpRequest.slice(0, 50);
const chunk2 = sampleHttpRequest.slice(50, 100);
const chunk3 = sampleHttpRequest.slice(100);

streamParser.write(chunk1);
console.log('Chunk 1 processed, parser state:', streamParser.getState());

streamParser.write(chunk2);
console.log('Chunk 2 processed, parser state:', streamParser.getState());

streamParser.write(chunk3);
console.log('Chunk 3 processed, parser state:', streamParser.getState());

const streamResult = streamParser.getResult();
console.timeEnd('HTTP Stream Parser');
console.log('Stream Parse Result:');
console.log(JSON.stringify(streamResult, null, 2));

// Reset the stream parser
streamParser.reset();
console.log('Stream parser reset, state:', streamParser.getState());

// Test Radix Router
console.log('\n=== Radix Router Test ===');
radixRouter.add('GET', '/api/users', dummyHandler);
radixRouter.add('GET', '/api/users/:id', dummyHandler);
radixRouter.add('GET', '/api/posts', dummyHandler);
radixRouter.add('GET', '/api/posts/:id', dummyHandler);

console.time('Radix Router');
const routeMatch = radixRouter.find('GET', '/api/users/123');
console.timeEnd('Radix Router');
console.log('Route Match:');
console.log(JSON.stringify(routeMatch, null, 2));

// Test JSON Processor
console.log('\n=== JSON Processor Test ===');
const jsonBuffer = Buffer.from(JSON.stringify(sampleJson));

console.time('JSON Parse (Buffer)');
const parsedJson = jsonProcessor.parse(jsonBuffer);
console.timeEnd('JSON Parse (Buffer)');

console.time('JSON Parse (String)');
const parsedJsonString = jsonProcessor.parse(JSON.stringify(sampleJson));
console.timeEnd('JSON Parse (String)');

console.time('JSON Stringify');
const stringifiedJson = jsonProcessor.stringify(sampleJson);
console.timeEnd('JSON Stringify');

console.log('Parsed JSON (sample):');
console.log(JSON.stringify(parsedJson.users[0], null, 2));
console.log('Stringified JSON Length:', stringifiedJson.length);

// Get performance metrics
console.log('\n=== Performance Metrics ===');
const metrics = getAllPerformanceMetrics();
console.log('HTTP Parser Metrics:');
console.log(JSON.stringify(metrics.httpParser, null, 2));
console.log('Radix Router Metrics:');
console.log(JSON.stringify(metrics.radixRouter, null, 2));
console.log('JSON Processor Metrics:');
console.log(JSON.stringify(metrics.jsonProcessor, null, 2));

// Compare JavaScript vs Native implementations
console.log('\n=== Performance Comparison ===');
console.log('JavaScript vs Native Implementation:');

if (metrics.httpParser) {
  const jsParseOps = metrics.httpParser.jsImplementation?.parseOps || 0;
  const nativeParseOps = metrics.httpParser.nativeImplementation?.parseOps || 0;

  if (jsParseOps > 0 && nativeParseOps > 0) {
    const improvement = ((nativeParseOps - jsParseOps) / jsParseOps * 100).toFixed(2);
    console.log(`HTTP Parser: Native is ${improvement}% faster than JavaScript`);
  }
}

if (metrics.radixRouter) {
  const jsFindOps = metrics.radixRouter.jsImplementation?.findRouteOps || 0;
  const nativeFindOps = metrics.radixRouter.nativeImplementation?.findRouteOps || 0;

  if (jsFindOps > 0 && nativeFindOps > 0) {
    const improvement = ((nativeFindOps - jsFindOps) / jsFindOps * 100).toFixed(2);
    console.log(`Radix Router: Native is ${improvement}% faster than JavaScript`);
  }
}

if (metrics.jsonProcessor) {
  const jsParseOps = metrics.jsonProcessor.jsImplementation?.parseOps || 0;
  const nativeParseOps = metrics.jsonProcessor.nativeImplementation?.parseOps || 0;

  if (jsParseOps > 0 && nativeParseOps > 0) {
    const improvement = ((nativeParseOps - jsParseOps) / jsParseOps * 100).toFixed(2);
    console.log(`JSON Parser: Native is ${improvement}% faster than JavaScript`);
  }

  const jsStringifyOps = metrics.jsonProcessor.jsImplementation?.stringifyOps || 0;
  const nativeStringifyOps = metrics.jsonProcessor.nativeImplementation?.stringifyOps || 0;

  if (jsStringifyOps > 0 && nativeStringifyOps > 0) {
    const improvement = ((nativeStringifyOps - jsStringifyOps) / jsStringifyOps * 100).toFixed(2);
    console.log(`JSON Stringify: Native is ${improvement}% faster than JavaScript`);
  }
}

console.log('\nExample completed successfully!');
