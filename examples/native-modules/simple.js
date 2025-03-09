/**
 * NexureJS Native Modules Simple Example
 *
 * This example demonstrates how to use the native modules directly.
 */

import { HttpParser, RadixRouter, JsonProcessor, hasNativeSupport } from '../../dist/src/native/index.js';
import { performance } from 'node:perf_hooks';

// Create a simple HTTP request buffer for testing
const sampleHttpRequest = Buffer.from(
  'GET /api/users?page=1&limit=20 HTTP/1.1\r\n' +
  'Host: example.com\r\n' +
  'User-Agent: Mozilla/5.0\r\n' +
  'Accept: application/json\r\n' +
  'Content-Type: application/json\r\n' +
  'Content-Length: 27\r\n' +
  '\r\n' +
  '{"username":"john","age":30}'
);

// Create a sample JSON object for testing
const sampleJsonObject = {
  id: 123,
  name: "Product",
  price: 99.99,
  inStock: true,
  tags: ["electronics", "gadget"],
  manufacturer: {
    id: 45,
    name: "ACME Corp",
    location: "New York"
  }
};

console.log('NexureJS Native Modules Example');
console.log('===============================');
console.log(`Native modules support: ${hasNativeSupport ? 'Enabled' : 'Disabled (using JavaScript fallbacks)'}`);
console.log();

// Test HTTP Parser
console.log('Testing HTTP Parser:');
const httpParser = new HttpParser();
const start1 = performance.now();
for (let i = 0; i < 1000; i++) {
  httpParser.parse(sampleHttpRequest);
}
const end1 = performance.now();
const duration1 = end1 - start1;
const result = httpParser.parse(sampleHttpRequest);
console.log(`- Parse time: ${duration1.toFixed(2)}ms for 1000 iterations`);
console.log(`- Operations per second: ${Math.floor(1000 / (duration1 / 1000))}`);
console.log(`- Result: ${result.method} ${result.url} HTTP/${result.httpVersion}`);
console.log(`- Headers: ${Object.keys(result.headers).length}`);
console.log(`- Body: ${result.body ? result.body.toString() : 'null'}`);
console.log();

// Test JSON Processor
console.log('Testing JSON Processor:');
const jsonProcessor = new JsonProcessor();
const jsonString = JSON.stringify(sampleJsonObject);
const start2 = performance.now();
for (let i = 0; i < 1000; i++) {
  const parsed = jsonProcessor.parse(jsonString);
  jsonProcessor.stringify(parsed);
}
const end2 = performance.now();
const duration2 = end2 - start2;
console.log(`- Process time: ${duration2.toFixed(2)}ms for 1000 iterations`);
console.log(`- Operations per second: ${Math.floor(1000 / (duration2 / 1000))}`);
console.log(`- Original size: ${jsonString.length} bytes`);
console.log();

// Test Radix Router
console.log('Testing Radix Router:');
const radixRouter = new RadixRouter();
radixRouter.add('GET', '/users', { handler: 'getAllUsers' });
radixRouter.add('GET', '/users/:id', { handler: 'getUserById' });
radixRouter.add('POST', '/users', { handler: 'createUser' });

const urls = ['/users', '/users/123', '/users/456', '/unknown/path'];
const start3 = performance.now();
for (let i = 0; i < 1000; i++) {
  for (const url of urls) {
    radixRouter.find('GET', url);
  }
}
const end3 = performance.now();
const duration3 = end3 - start3;
console.log(`- Route time: ${duration3.toFixed(2)}ms for ${urls.length * 1000} lookups`);
console.log(`- Operations per second: ${Math.floor((urls.length * 1000) / (duration3 / 1000))}`);

// Show route matching results
for (const url of urls) {
  const match = radixRouter.find('GET', url);
  console.log(`- ${url}: ${match.found ? 'Found' : 'Not found'}${match.found ? ` (handler: ${match.handler.handler})` : ''}`);
  if (Object.keys(match.params).length > 0) {
    console.log(`  Parameters: ${JSON.stringify(match.params)}`);
  }
}

console.log();
console.log('Benchmark complete!');
