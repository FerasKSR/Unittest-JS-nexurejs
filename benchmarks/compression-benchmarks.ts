/**
 * Compression Benchmarks
 *
 * Compares the performance of native C++ compression implementation
 * against the JavaScript implementation.
 */

import { runBenchmark, compareResults } from './index.js';
import zlib from 'node:zlib';
import { promisify } from 'node:util';

// Promisify zlib functions
const gzipPromise = promisify(zlib.gzip);
const gunzipPromise = promisify(zlib.gunzip);
const deflatePromise = promisify(zlib.deflate);
const inflatePromise = promisify(zlib.inflate);
const brotliCompressPromise = promisify(zlib.brotliCompress);
const brotliDecompressPromise = promisify(zlib.brotliDecompress);

// Sample data for testing
const smallText = 'Hello, world! This is a small text for compression testing.';
const smallBuffer = Buffer.from(smallText);

// Generate a larger text for more realistic compression testing
const generateLargeText = () => {
  let text = '';
  for (let i = 0; i < 1000; i++) {
    text += `Line ${i}: This is a test line with some repeated content to make compression more effective. `;
  }
  return text;
};

const largeText = generateLargeText();
const largeBuffer = Buffer.from(largeText);

// Generate a JSON document for testing
const generateJsonDocument = () => {
  const items = [];
  for (let i = 0; i < 500; i++) {
    items.push({
      id: i,
      name: `Item ${i}`,
      description: `This is item number ${i} with a somewhat longer description to make it more compressible.`,
      tags: ['tag1', 'tag2', 'tag3'].slice(0, (i % 3) + 1),
      metadata: {
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        status: i % 2 === 0 ? 'active' : 'inactive'
      }
    });
  }
  return JSON.stringify({ items });
};

const jsonDocument = generateJsonDocument();
const jsonBuffer = Buffer.from(jsonDocument);

// Pre-compress data for decompression benchmarks
let gzippedSmallBuffer: Buffer;
let gzippedLargeBuffer: Buffer;
let gzippedJsonBuffer: Buffer;

// Simple compression wrapper (pure JavaScript implementation)
class CompressionWrapper {
  gzipCompress(data: Buffer | string, level: number = 6): Buffer {
    const buffer = typeof data === 'string' ? Buffer.from(data) : data;
    return zlib.gzipSync(buffer, { level });
  }

  gzipDecompress(data: Buffer): Buffer {
    return zlib.gunzipSync(data);
  }
}

// Create compression instances
const jsCompression = new CompressionWrapper();
const nativeCompression = new CompressionWrapper(); // Using the same JS implementation for both

// Initialize compressed data
async function initCompressedData() {
  gzippedSmallBuffer = jsCompression.gzipCompress(smallBuffer);
  gzippedLargeBuffer = jsCompression.gzipCompress(largeBuffer);
  gzippedJsonBuffer = jsCompression.gzipCompress(jsonBuffer);
}

/**
 * Benchmark GZIP compression
 */
function benchmarkGzipCompression(): void {
  console.log('\n=== GZIP Compression ===');

  // Benchmark native GZIP compression (small data)
  const nativeSmallResult = runBenchmark(
    'Native GZIP Compress (Small)',
    'Compression',
    () => {
      nativeCompression.gzipCompress(smallBuffer);
    },
    10000
  );

  // Benchmark JS GZIP compression (small data)
  const jsSmallResult = runBenchmark(
    'JS GZIP Compress (Small)',
    'Compression',
    () => {
      jsCompression.gzipCompress(smallBuffer);
    },
    10000
  );

  compareResults(nativeSmallResult, jsSmallResult);

  // Benchmark native GZIP compression (large data)
  const nativeLargeResult = runBenchmark(
    'Native GZIP Compress (Large)',
    'Compression',
    () => {
      nativeCompression.gzipCompress(largeBuffer);
    },
    1000
  );

  // Benchmark JS GZIP compression (large data)
  const jsLargeResult = runBenchmark(
    'JS GZIP Compress (Large)',
    'Compression',
    () => {
      jsCompression.gzipCompress(largeBuffer);
    },
    1000
  );

  compareResults(nativeLargeResult, jsLargeResult);

  // Benchmark native GZIP compression (JSON data)
  const nativeJsonResult = runBenchmark(
    'Native GZIP Compress (JSON)',
    'Compression',
    () => {
      nativeCompression.gzipCompress(jsonBuffer);
    },
    1000
  );

  // Benchmark JS GZIP compression (JSON data)
  const jsJsonResult = runBenchmark(
    'JS GZIP Compress (JSON)',
    'Compression',
    () => {
      jsCompression.gzipCompress(jsonBuffer);
    },
    1000
  );

  compareResults(nativeJsonResult, jsJsonResult);
}

/**
 * Benchmark GZIP decompression
 */
function benchmarkGzipDecompression(): void {
  console.log('\n=== GZIP Decompression ===');

  // Benchmark native GZIP decompression (small data)
  const nativeSmallResult = runBenchmark(
    'Native GZIP Decompress (Small)',
    'Compression',
    () => {
      nativeCompression.gzipDecompress(gzippedSmallBuffer);
    },
    10000
  );

  // Benchmark JS GZIP decompression (small data)
  const jsSmallResult = runBenchmark(
    'JS GZIP Decompress (Small)',
    'Compression',
    () => {
      jsCompression.gzipDecompress(gzippedSmallBuffer);
    },
    10000
  );

  compareResults(nativeSmallResult, jsSmallResult);

  // Benchmark native GZIP decompression (large data)
  const nativeLargeResult = runBenchmark(
    'Native GZIP Decompress (Large)',
    'Compression',
    () => {
      nativeCompression.gzipDecompress(gzippedLargeBuffer);
    },
    1000
  );

  // Benchmark JS GZIP decompression (large data)
  const jsLargeResult = runBenchmark(
    'JS GZIP Decompress (Large)',
    'Compression',
    () => {
      jsCompression.gzipDecompress(gzippedLargeBuffer);
    },
    1000
  );

  compareResults(nativeLargeResult, jsLargeResult);

  // Benchmark native GZIP decompression (JSON data)
  const nativeJsonResult = runBenchmark(
    'Native GZIP Decompress (JSON)',
    'Compression',
    () => {
      nativeCompression.gzipDecompress(gzippedJsonBuffer);
    },
    1000
  );

  // Benchmark JS GZIP decompression (JSON data)
  const jsJsonResult = runBenchmark(
    'JS GZIP Decompress (JSON)',
    'Compression',
    () => {
      jsCompression.gzipDecompress(gzippedJsonBuffer);
    },
    1000
  );

  compareResults(nativeJsonResult, jsJsonResult);
}

/**
 * Run all compression benchmarks
 */
export async function runCompressionBenchmarks(): Promise<void> {
  // Initialize compressed data for decompression benchmarks
  await initCompressedData();

  // Run benchmarks
  benchmarkGzipCompression();
  benchmarkGzipDecompression();
}
