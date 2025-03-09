/**
 * Simple Benchmark for NexureJS
 *
 * This is a simple benchmark to test the setup.
 */

console.log('Starting Simple Benchmark');

// Simple function to benchmark
function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Run the benchmark
async function runBenchmark() {
  console.log('Running fibonacci(30)');
  const start = performance.now();
  const result = fibonacci(30);
  const end = performance.now();
  console.log(`Result: ${result}`);
  console.log(`Time: ${end - start}ms`);
}

// Run the benchmark
runBenchmark().catch(err => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
