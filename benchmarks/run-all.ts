/**
 * NexureJS Benchmark Runner
 *
 * This script runs all benchmarks for NexureJS components and generates
 * a comprehensive report of the results.
 */

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

// List of benchmark files to run
const benchmarks = [
  'http-benchmark.ts',
  'json-benchmark.ts',
  'worker-pool-benchmark.ts',
  'v8-optimizer-benchmark.ts'
];

// Function to run a benchmark file
async function runBenchmark(file: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n\n${'='.repeat(80)}`);
    console.log(`Running benchmark: ${file}`);
    console.log(`${'='.repeat(80)}\n`);

    const process = spawn('npx', ['ts-node', join('benchmarks', file)], {
      stdio: 'inherit'
    });

    process.on('close', (code) => {
      if (code === 0) {
        console.log(`\nBenchmark ${file} completed successfully`);
        resolve();
      } else {
        console.error(`\nBenchmark ${file} failed with code ${code}`);
        reject(new Error(`Benchmark failed with code ${code}`));
      }
    });

    process.on('error', (err) => {
      console.error(`\nError running benchmark ${file}:`, err);
      reject(err);
    });
  });
}

// Main function to run all benchmarks
async function runAllBenchmarks() {
  console.log('Starting NexureJS Benchmarks');
  console.log(`Running ${benchmarks.length} benchmark files\n`);

  const startTime = performance.now();
  const results: { file: string; success: boolean; error?: string }[] = [];

  // Create benchmark results directory
  const resultsDir = join(process.cwd(), 'benchmark-results');
  await mkdir(resultsDir, { recursive: true });

  // Run each benchmark
  for (const benchmark of benchmarks) {
    try {
      await runBenchmark(benchmark);
      results.push({ file: benchmark, success: true });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      results.push({ file: benchmark, success: false, error });
    }
  }

  const endTime = performance.now();
  const totalTime = (endTime - startTime) / 1000; // Convert to seconds

  // Generate summary report
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;

  console.log(`\n\n${'='.repeat(80)}`);
  console.log('Benchmark Summary');
  console.log(`${'='.repeat(80)}`);
  console.log(`Total benchmarks: ${results.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${failureCount}`);
  console.log(`Total time: ${totalTime.toFixed(2)} seconds`);

  // List failed benchmarks if any
  if (failureCount > 0) {
    console.log('\nFailed benchmarks:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`- ${r.file}: ${r.error}`);
    });
  }

  // Save summary report
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const summaryPath = join(resultsDir, `summary-${timestamp}.json`);

  await writeFile(summaryPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalBenchmarks: results.length,
    successful: successCount,
    failed: failureCount,
    totalTimeSeconds: totalTime,
    results
  }, null, 2));

  console.log(`\nSummary report saved to: ${summaryPath}`);
}

// Run all benchmarks
runAllBenchmarks().catch(err => {
  console.error('Error running benchmarks:', err);
  process.exit(1);
});
