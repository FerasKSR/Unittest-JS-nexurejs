/**
 * HTTP Parser Benchmarks
 *
 * Compares the performance of native C++ HTTP parser implementation
 * against the JavaScript implementation.
 */

import { runBenchmark, compareResults } from './index.js';
import { HttpParser as NativeHttpParser } from '../src/native/index.js';
import { JsHttpParser } from '../src/http/http-parser.js';

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

// Sample HTTP response for testing
const sampleHttpResponse = Buffer.from(
  'HTTP/1.1 200 OK\r\n' +
  'Content-Type: application/json\r\n' +
  'Content-Length: 123\r\n' +
  'Date: Mon, 23 May 2023 12:34:56 GMT\r\n' +
  'Server: NexureJS\r\n' +
  '\r\n' +
  '{"status":"success","data":{"users":[{"id":1,"name":"John"},{"id":2,"name":"Jane"}]},"meta":{"total":2,"page":1}}'
);

/**
 * Benchmark HTTP request parsing
 */
function benchmarkHttpRequestParsing(): void {
  console.log('\n=== HTTP Request Parsing ===');

  // Create parsers
  const nativeParser = new NativeHttpParser();
  const jsParser = new JsHttpParser();

  // Benchmark native implementation
  const nativeResult = runBenchmark('Native HTTP Request Parser', 'http', () => {
    nativeParser.parse(sampleHttpRequest);
  });

  // Benchmark JavaScript implementation
  const jsResult = runBenchmark('JS HTTP Request Parser', 'http', () => {
    jsParser.parse(sampleHttpRequest);
  });

  // Compare results
  compareResults(nativeResult, jsResult);
}

/**
 * Benchmark HTTP headers parsing
 */
function benchmarkHttpHeadersParsing(): void {
  console.log('\n=== HTTP Headers Parsing ===');

  // Create parsers
  const nativeParser = new NativeHttpParser();
  const jsParser = new JsHttpParser();

  // Benchmark native implementation
  const nativeResult = runBenchmark('Native HTTP Headers Parser', 'http', () => {
    nativeParser.parseHeaders(sampleHttpRequest);
  });

  // Benchmark JavaScript implementation
  const jsResult = runBenchmark('JS HTTP Headers Parser', 'http', () => {
    jsParser.parseHeaders(sampleHttpRequest);
  });

  // Compare results
  compareResults(nativeResult, jsResult);
}

/**
 * Benchmark HTTP body parsing
 */
function benchmarkHttpBodyParsing(): void {
  console.log('\n=== HTTP Body Parsing ===');

  // Create parsers
  const nativeParser = new NativeHttpParser();
  const jsParser = new JsHttpParser();

  // Content length
  const contentLength = 26; // Length of {"name":"John","age":30}

  // Benchmark native implementation
  const nativeResult = runBenchmark('Native HTTP Body Parser', 'http', () => {
    nativeParser.parseBody(sampleHttpRequest, contentLength);
  });

  // Benchmark JavaScript implementation
  const jsResult = runBenchmark('JS HTTP Body Parser', 'http', () => {
    jsParser.parseBody(sampleHttpRequest, contentLength);
  });

  // Compare results
  compareResults(nativeResult, jsResult);
}

/**
 * Run all HTTP benchmarks
 */
export async function runHttpBenchmarks(): Promise<void> {
  benchmarkHttpRequestParsing();
  benchmarkHttpHeadersParsing();
  benchmarkHttpBodyParsing();
}
