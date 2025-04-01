/**
 * NexureJS Native Modules Example
 *
 * This example demonstrates how to use the native modules in NexureJS.
 * It shows how to configure, check status, and use the native modules.
 */

import {
  HttpParser,
  RadixRouter,
  JsonProcessor,
  configureNativeModules,
  getNativeModuleStatus,
  resetAllPerformanceMetrics,
  getAllPerformanceMetrics
} from '../../src/native';
import { IncomingMessage, ServerResponse } from 'node:http';

// Create a dummy route handler function
const dummyHandler = async (req: IncomingMessage, res: ServerResponse) => {
  return { success: true };
};

// Configure native modules
configureNativeModules({
  enabled: true,
  verbose: true,
  maxCacheSize: 1000
});

// Check if native modules are available
const status = getNativeModuleStatus();
console.log('Native Module Status:');
console.log(JSON.stringify(status, null, 2));

// Create instances of native modules
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

// Reset performance metrics
resetAllPerformanceMetrics();

// Test HTTP Parser
console.log('\n=== HTTP Parser Test ===');
const parseResult = httpParser.parse(sampleHttpRequest);
console.log('Parse Result:');
console.log(JSON.stringify(parseResult, null, 2));

// Test Radix Router
console.log('\n=== Radix Router Test ===');
radixRouter.add('GET', '/api/users', dummyHandler);
radixRouter.add('GET', '/api/users/:id', dummyHandler);
radixRouter.add('GET', '/api/posts', dummyHandler);
radixRouter.add('GET', '/api/posts/:id', dummyHandler);

const routeMatch = radixRouter.find('GET', '/api/users/123');
console.log('Route Match:');
console.log(JSON.stringify(routeMatch, null, 2));

// Test JSON Processor
console.log('\n=== JSON Processor Test ===');
const jsonBuffer = Buffer.from(JSON.stringify(sampleJson));
const parsedJson = jsonProcessor.parse(jsonBuffer);
console.log('Parsed JSON:');
console.log(JSON.stringify(parsedJson, null, 2));

const stringifiedJson = jsonProcessor.stringify(sampleJson);
console.log('Stringified JSON Length:', stringifiedJson.length);

// Get performance metrics
console.log('\n=== Performance Metrics ===');
const metrics = getAllPerformanceMetrics();
console.log(JSON.stringify(metrics, null, 2));

// Compare JavaScript vs Native implementations
console.log('\n=== Performance Comparison ===');
console.log('Running 10,000 iterations of each operation...');

// HTTP Parser comparison
console.time('Native HTTP Parser');
for (let i = 0; i < 10000; i++) {
  httpParser.parse(sampleHttpRequest);
}
console.timeEnd('Native HTTP Parser');

// Radix Router comparison
console.time('Native Radix Router');
for (let i = 0; i < 10000; i++) {
  radixRouter.find('GET', '/api/users/123');
}
console.timeEnd('Native Radix Router');

// JSON Processor comparison
console.time('Native JSON Parse');
for (let i = 0; i < 10000; i++) {
  jsonProcessor.parse(jsonBuffer);
}
console.timeEnd('Native JSON Parse');

console.time('Native JSON Stringify');
for (let i = 0; i < 10000; i++) {
  jsonProcessor.stringify(sampleJson);
}
console.timeEnd('Native JSON Stringify');

console.log('\nExample completed successfully!');
