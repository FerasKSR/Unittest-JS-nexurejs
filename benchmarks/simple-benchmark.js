/**
 * Simple Benchmark for NexureJS
 *
 * This is a simple benchmark to test the setup.
 */

import { Benchmark, BenchmarkSuite } from '../src/utils/performance-benchmark.js';
import { v8Optimizer } from '../src/utils/v8-optimizer.js';

console.log('Starting Simple Benchmark');

// Simple function to benchmark
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Optimized version
const optimizedFibonacci = v8Optimizer.optimizeFunction(
  (n) => {
    if (n <= 1) return n;
    return optimizedFibonacci(n - 1) + optimizedFibonacci(n - 2);
  }
);

// Run the benchmark
async function runBenchmark() {
  // Create a benchmark suite
  const suite = new BenchmarkSuite({
    name: 'Fibonacci Benchmark',
    description: 'Comparing standard and optimized fibonacci implementations',
    baseOptions: {
      iterations: 100,
      warmup: 10
    }
  });

  // Add benchmarks
  suite.add(() => {
    return fibonacci(20);
  }, {
    name: 'Standard Fibonacci',
    description: 'Standard recursive fibonacci implementation'
  });

  suite.add(() => {
    return optimizedFibonacci(20);
  }, {
    name: 'Optimized Fibonacci',
    description: 'Optimized recursive fibonacci implementation'
  });

  // Run the suite
  const results = await suite.run();

  // Compare results
  console.log(suite.compareResults('Standard Fibonacci', 'Optimized Fibonacci', results));

  // Save results
  suite.saveResults(results);
}

// Run the benchmark
runBenchmark().catch(err => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
