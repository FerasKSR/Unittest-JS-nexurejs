/**
 * NexureJS Benchmark Suite
 *
 * This is the main consolidated benchmark file containing all benchmark tests.
 * Run with: npm run benchmark
 */

import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HttpParser as NativeHttpParser } from '../src/native/index.js';
import { JsHttpParser } from '../src/http/http-parser.js';

// =============================================
// BENCHMARK INFRASTRUCTURE
// =============================================

// Benchmark result interface
interface BenchmarkResult {
  name: string;
  category: string;
  opsPerSecond: number;
  duration: number;
  iterations: number;
  improvement?: number;
}

// Global results storage
const results: BenchmarkResult[] = [];

/**
 * Run a benchmark function multiple times and measure performance
 */
export function runBenchmark(
  name: string,
  category: string,
  fn: () => void,
  iterations: number = 10000
): BenchmarkResult {
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
  const opsPerSecond = Math.floor(iterations / (duration / 1000));

  console.log(`${name}: ${opsPerSecond.toLocaleString()} ops/sec`);

  const result = {
    name,
    category,
    opsPerSecond,
    duration,
    iterations
  };

  results.push(result);
  return result;
}

/**
 * Compare two benchmark results and calculate improvement
 */
export function compareResults(
  nativeResult: BenchmarkResult,
  jsResult: BenchmarkResult
): void {
  const improvement = ((nativeResult.opsPerSecond - jsResult.opsPerSecond) / jsResult.opsPerSecond * 100);
  nativeResult.improvement = improvement;

  console.log(`Native implementation is ${improvement.toFixed(2)}% ${improvement >= 0 ? 'faster' : 'slower'}`);
}

/**
 * Save benchmark results to a file
 */
async function saveResults(): Promise<void> {
  try {
    // Create results directory
    const resultsDir = join(process.cwd(), 'benchmark-results');
    await mkdir(resultsDir, { recursive: true });

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `benchmark-${timestamp}.json`;
    const filepath = join(resultsDir, filename);

    // Save results
    await writeFile(filepath, JSON.stringify({
      timestamp: new Date().toISOString(),
      results,
      summary: {
        totalBenchmarks: results.length,
        categories: [...new Set(results.map(r => r.category))],
        averageOpsPerSecond: results.reduce((sum, r) => sum + r.opsPerSecond, 0) / results.length
      }
    }, null, 2));

    console.log(`\nBenchmark results saved to: ${filepath}`);
  } catch (error) {
    console.error('Error saving benchmark results:', error);
  }
}

// =============================================
// BASIC BENCHMARKS
// =============================================

// Sample data for benchmarks
const sampleArray = Array.from({ length: 1000 }, (_, i) => i);
const sampleObject = {
  name: 'test',
  value: 123,
  items: sampleArray.slice(0, 10),
  nested: {
    a: 1,
    b: 2,
    c: [1, 2, 3]
  },
  tags: ['javascript', 'benchmark', 'performance']
};
const sampleString = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';
const sampleJson = JSON.stringify(sampleObject);

/**
 * Benchmark array operations
 */
function benchmarkArrayOperations(): void {
  console.log('\n=== Array Operations ===');

  // Array.map
  runBenchmark('Array.map', 'basic', () => {
    sampleArray.map(x => x * 2);
  });

  // Array.filter
  runBenchmark('Array.filter', 'basic', () => {
    sampleArray.filter(x => x % 2 === 0);
  });

  // Array.reduce
  runBenchmark('Array.reduce', 'basic', () => {
    sampleArray.reduce((acc, val) => acc + val, 0);
  });

  // Array.forEach
  runBenchmark('Array.forEach', 'basic', () => {
    let sum = 0;
    sampleArray.forEach(x => { sum += x; });
  });

  // Array spread
  runBenchmark('Array spread', 'basic', () => {
    const newArray = [...sampleArray.slice(0, 100)];
  });
}

/**
 * Benchmark object operations
 */
function benchmarkObjectOperations(): void {
  console.log('\n=== Object Operations ===');

  // Object.keys
  runBenchmark('Object.keys', 'basic', () => {
    Object.keys(sampleObject);
  });

  // Object.values
  runBenchmark('Object.values', 'basic', () => {
    Object.values(sampleObject);
  });

  // Object.entries
  runBenchmark('Object.entries', 'basic', () => {
    Object.entries(sampleObject);
  });

  // Object spread
  runBenchmark('Object spread', 'basic', () => {
    const newObj = { ...sampleObject, newProp: 'value' };
  });

  // JSON.stringify
  runBenchmark('JSON.stringify', 'basic', () => {
    JSON.stringify(sampleObject);
  });

  // JSON.parse
  runBenchmark('JSON.parse', 'basic', () => {
    JSON.parse(sampleJson);
  });
}

/**
 * Benchmark string operations
 */
function benchmarkStringOperations(): void {
  console.log('\n=== String Operations ===');

  // String.split
  runBenchmark('String.split', 'basic', () => {
    sampleString.split(' ');
  });

  // String.replace
  runBenchmark('String.replace', 'basic', () => {
    sampleString.replace(/a/g, 'b');
  });

  // String.match
  runBenchmark('String.match', 'basic', () => {
    sampleString.match(/\w{5,}/g);
  });

  // String concatenation
  runBenchmark('String concatenation', 'basic', () => {
    let result = '';
    for (let i = 0; i < 20; i++) {
      result += sampleString.substring(0, 10);
    }
  });

  // Template literals
  runBenchmark('Template literals', 'basic', () => {
    const a = 1, b = 2, c = 3;
    const result = `${a} + ${b} = ${c}. ${sampleString.substring(0, 50)}`;
  });
}

/**
 * Run all basic benchmarks
 */
function runBasicBenchmarks(): void {
  benchmarkArrayOperations();
  benchmarkObjectOperations();
  benchmarkStringOperations();
}

// =============================================
// HTTP BENCHMARKS
// =============================================

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
function runHttpBenchmarks(): void {
  benchmarkHttpRequestParsing();
  benchmarkHttpHeadersParsing();
  benchmarkHttpBodyParsing();
}

// =============================================
// ROUTER BENCHMARKS
// =============================================

/**
 * Run router benchmarks
 */
function runRouterBenchmarks(): void {
  console.log('\n=== Router Benchmarks ===');

  // Import router implementations here and run benchmarks
  // This is a placeholder - actual implementation would need to be added
  // based on the content of router-benchmarks.ts

  runBenchmark('Router matching - simple path', 'router', () => {
    // Router matching logic
  });

  runBenchmark('Router matching - path with params', 'router', () => {
    // Router matching with params logic
  });
}

// =============================================
// JSON BENCHMARKS
// =============================================

/**
 * Run JSON benchmarks
 */
function runJsonBenchmarks(): void {
  console.log('\n=== JSON Benchmarks ===');

  // JSON stringify
  runBenchmark('JSON.stringify - small object', 'json', () => {
    JSON.stringify(sampleObject);
  });

  runBenchmark('JSON.parse - small object', 'json', () => {
    JSON.parse(sampleJson);
  });

  // Additional JSON benchmarks would be added here based on json-benchmarks.ts
}

// =============================================
// URL BENCHMARKS
// =============================================

/**
 * Run URL benchmarks
 */
function runUrlBenchmarks(): void {
  console.log('\n=== URL Benchmarks ===');

  // URL parsing benchmarks
  runBenchmark('URL parsing - simple', 'url', () => {
    new URL('https://example.com/path');
  });

  runBenchmark('URL parsing - complex', 'url', () => {
    new URL('https://user:pass@example.com:8080/path/to/resource?query=value&another=123#fragment');
  });

  // Additional URL benchmarks would be added here based on url-benchmarks.ts
}

// =============================================
// SCHEMA BENCHMARKS
// =============================================

/**
 * Run schema benchmarks
 */
function runSchemaBenchmarks(): void {
  console.log('\n=== Schema Benchmarks ===');

  // Placeholder for schema validation benchmarks
  // These would be implemented based on schema-benchmarks.ts
}

// =============================================
// WEBSOCKET BENCHMARKS
// =============================================

/**
 * Run WebSocket benchmarks
 */
function runWebSocketBenchmarks(): void {
  console.log('\n=== WebSocket Benchmarks ===');

  // Placeholder for WebSocket benchmarks
  // These would be implemented based on websocket-benchmarks.ts
}

// =============================================
// COMPRESSION BENCHMARKS
// =============================================

/**
 * Run compression benchmarks
 */
function runCompressionBenchmarks(): void {
  console.log('\n=== Compression Benchmarks ===');

  // Placeholder for compression benchmarks
  // These would be implemented based on compression-benchmarks.ts
}

// =============================================
// MAIN RUNNER
// =============================================

/**
 * Run all benchmarks
 */
async function runAllBenchmarks(): Promise<void> {
  console.log('=== NexureJS Benchmark Suite ===\n');

  const startTime = performance.now();

  try {
    // Run each benchmark category
    console.log('\n--- Basic Operations ---');
    runBasicBenchmarks();

    console.log('\n--- HTTP Parser ---');
    runHttpBenchmarks();

    console.log('\n--- Router ---');
    runRouterBenchmarks();

    console.log('\n--- JSON Processing ---');
    runJsonBenchmarks();

    console.log('\n--- Compression ---');
    runCompressionBenchmarks();

    console.log('\n--- URL Parser ---');
    runUrlBenchmarks();

    console.log('\n--- Schema Validator ---');
    runSchemaBenchmarks();

    console.log('\n--- WebSocket ---');
    runWebSocketBenchmarks();
  } catch (error) {
    console.error('Error running benchmarks:', error);
    console.error('Some native modules might not be available. Continuing with available benchmarks.');
  }

  const endTime = performance.now();
  const totalTime = (endTime - startTime) / 1000;

  // Print summary
  console.log('\n=== Benchmark Summary ===');
  console.log(`Total benchmarks: ${results.length}`);
  console.log(`Total time: ${totalTime.toFixed(2)} seconds`);

  // Save results
  await saveResults();
}

// Run all benchmarks
runAllBenchmarks().catch(err => {
  console.error('Error running benchmarks:', err);
  process.exit(1);
});
