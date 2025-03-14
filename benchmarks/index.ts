/**
 * NexureJS Benchmark Suite
 *
 * This is the main entry point for all benchmarks.
 * Run with: npm run benchmark
 */

import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

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

/**
 * Run all benchmarks
 */
async function runAllBenchmarks(): Promise<void> {
  console.log('=== NexureJS Benchmark Suite ===\n');

  const startTime = performance.now();

  // Dynamically import benchmark modules to avoid circular dependencies
  const { runBasicBenchmarks } = await import('./basic-benchmarks.js');
  const { runHttpBenchmarks } = await import('./http-benchmarks.js');
  const { runRouterBenchmarks } = await import('./router-benchmarks.js');
  const { runJsonBenchmarks } = await import('./json-benchmarks.js');
  const { runCompressionBenchmarks } = await import('./compression-benchmarks.js');
  const { runUrlBenchmarks } = await import('./url-benchmarks.js');
  const { runSchemaBenchmarks } = await import('./schema-benchmarks.js');
  const { runWebSocketBenchmarks } = await import('./websocket-benchmarks.js');

  try {
    // Run each benchmark category
    console.log('\n--- Basic Operations ---');
    await runBasicBenchmarks();

    console.log('\n--- HTTP Parser ---');
    await runHttpBenchmarks();

    console.log('\n--- Router ---');
    await runRouterBenchmarks();

    console.log('\n--- JSON Processing ---');
    await runJsonBenchmarks();

    console.log('\n--- Compression ---');
    await runCompressionBenchmarks();

    console.log('\n--- URL Parser ---');
    await runUrlBenchmarks();

    console.log('\n--- Schema Validator ---');
    await runSchemaBenchmarks();

    console.log('\n--- WebSocket ---');
    await runWebSocketBenchmarks();
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
