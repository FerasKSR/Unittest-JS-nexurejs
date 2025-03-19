/**
 * JSON Processing Benchmarks
 *
 * Compares the performance of native C++ JSON processor implementation
 * against the JavaScript implementation.
 */

import { runBenchmark, compareResults } from './index.js';
import { JsonProcessor as NativeJsonProcessor } from '../src/native/index.js';

// Sample JSON data for testing
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

// Prepare JSON string
const jsonString = JSON.stringify(sampleJson);
const jsonBuffer = Buffer.from(jsonString);

// Large JSON data for testing
const largeSampleJson = {
  items: Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
    description: `This is a description for item ${i}. It contains some text to make it larger.`,
    tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'].slice(0, (i % 5) + 1),
    properties: {
      color: ['red', 'green', 'blue', 'yellow', 'purple'][i % 5],
      size: ['small', 'medium', 'large', 'xlarge'][i % 4],
      weight: Math.random() * 100,
      dimensions: {
        width: Math.random() * 10,
        height: Math.random() * 10,
        depth: Math.random() * 10
      }
    },
    created: new Date(Date.now() - i * 86400000).toISOString(),
    status: ['active', 'inactive', 'pending', 'archived'][i % 4]
  })),
  metadata: {
    totalItems: 1000,
    generatedAt: new Date().toISOString(),
    server: 'NexureJS Benchmark',
    version: '1.0.0',
    settings: {
      compression: true,
      encryption: false,
      caching: true,
      ttl: 3600
    }
  }
};

// Prepare large JSON string
const largeJsonString = JSON.stringify(largeSampleJson);
const largeJsonBuffer = Buffer.from(largeJsonString);

/**
 * Benchmark JSON parsing
 */
function benchmarkJsonParsing(): void {
  console.log('\n=== JSON Parsing ===');

  // Create JSON processor
  const nativeJson = new NativeJsonProcessor();

  // Benchmark native parse implementation (Buffer)
  const nativeBufferResult = runBenchmark('Native JSON Parse (Buffer)', 'json', () => {
    nativeJson.parse(jsonBuffer);
  });

  // Benchmark native parse implementation (String)
  const nativeStringResult = runBenchmark('Native JSON Parse (String)', 'json', () => {
    nativeJson.parse(jsonString);
  });

  // Benchmark JavaScript parse implementation
  const jsResult = runBenchmark('JS JSON.parse', 'json', () => {
    JSON.parse(jsonString);
  });

  // Compare results
  compareResults(nativeBufferResult, jsResult);
  compareResults(nativeStringResult, jsResult);
}

/**
 * Benchmark JSON stringifying
 */
function benchmarkJsonStringifying(): void {
  console.log('\n=== JSON Stringifying ===');

  // Create JSON processor
  const nativeJson = new NativeJsonProcessor();

  // Benchmark native stringify implementation
  const nativeResult = runBenchmark('Native JSON Stringify', 'json', () => {
    nativeJson.stringify(sampleJson);
  });

  // Benchmark JavaScript stringify implementation
  const jsResult = runBenchmark('JS JSON.stringify', 'json', () => {
    JSON.stringify(sampleJson);
  });

  // Compare results
  compareResults(nativeResult, jsResult);
}

/**
 * Benchmark large JSON parsing
 */
function benchmarkLargeJsonParsing(): void {
  console.log('\n=== Large JSON Parsing ===');

  // Create JSON processor
  const nativeJson = new NativeJsonProcessor();

  // Benchmark native parse implementation (Buffer)
  const nativeBufferResult = runBenchmark('Native Large JSON Parse (Buffer)', 'json', () => {
    nativeJson.parse(largeJsonBuffer);
  }, 100);

  // Benchmark native parse implementation (String)
  const nativeStringResult = runBenchmark('Native Large JSON Parse (String)', 'json', () => {
    nativeJson.parse(largeJsonString);
  }, 100);

  // Benchmark JavaScript parse implementation
  const jsResult = runBenchmark('JS Large JSON.parse', 'json', () => {
    JSON.parse(largeJsonString);
  }, 100);

  // Compare results
  compareResults(nativeBufferResult, jsResult);
  compareResults(nativeStringResult, jsResult);
}

/**
 * Benchmark large JSON stringifying
 */
function benchmarkLargeJsonStringifying(): void {
  console.log('\n=== Large JSON Stringifying ===');

  // Create JSON processor
  const nativeJson = new NativeJsonProcessor();

  // Benchmark native stringify implementation
  const nativeResult = runBenchmark('Native Large JSON Stringify', 'json', () => {
    nativeJson.stringify(largeSampleJson);
  }, 100);

  // Benchmark JavaScript stringify implementation
  const jsResult = runBenchmark('JS Large JSON.stringify', 'json', () => {
    JSON.stringify(largeSampleJson);
  }, 100);

  // Compare results
  compareResults(nativeResult, jsResult);
}

/**
 * Run all JSON benchmarks
 */
export async function runJsonBenchmarks(): Promise<void> {
  benchmarkJsonParsing();
  benchmarkJsonStringifying();
  benchmarkLargeJsonParsing();
  benchmarkLargeJsonStringifying();
}
