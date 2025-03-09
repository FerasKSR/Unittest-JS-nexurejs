/**
 * Simple Worker Pool Benchmark for NexureJS (JS version)
 *
 * A JavaScript-only implementation that doesn't depend on TypeScript.
 */

import { randomUUID } from 'node:crypto';
import { cpus } from 'node:os';

// CPU-intensive task: calculate fibonacci numbers recursively
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// IO-bound task simulation: sleep for a given time
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Mixed workload task
async function mixedWorkload(cpuIntensity, ioTime) {
  // CPU work
  const fibResult = fibonacci(cpuIntensity);

  // IO work
  await sleep(ioTime);

  return fibResult;
}

// Run a simple benchmark of different task types
async function runTaskBenchmark() {
  console.log('Starting Simple Task Benchmark');

  // Test 1: CPU-intensive tasks
  console.log('\nTest 1: CPU-intensive tasks (Fibonacci calculation)');
  console.time('Fibonacci calculation');

  // Calculate fibonacci numbers
  const fibResults = [];
  for (let i = 30; i < 35; i++) {
    const start = performance.now();
    const result = fibonacci(i);
    const end = performance.now();
    fibResults.push({
      input: i,
      result,
      time: end - start
    });
  }

  console.timeEnd('Fibonacci calculation');

  // Print results
  console.log('Fibonacci results:');
  for (const result of fibResults) {
    console.log(`  fib(${result.input}) = ${result.result} (${result.time.toFixed(2)}ms)`);
  }

  // Test 2: IO-bound tasks
  console.log('\nTest 2: IO-bound tasks (sleep)');
  console.time('Sleep operations');

  // Run sleep operations
  const sleepTimes = [50, 100, 150];
  for (const time of sleepTimes) {
    const start = performance.now();
    await sleep(time);
    const end = performance.now();
    console.log(`  Sleep for ${time}ms took ${(end - start).toFixed(2)}ms`);
  }

  console.timeEnd('Sleep operations');

  // Test 3: Mixed workload
  console.log('\nTest 3: Mixed workload (Fibonacci + sleep)');
  console.time('Mixed workload');

  // Run mixed workload
  const workloads = [
    { cpu: 25, io: 20 },
    { cpu: 30, io: 10 },
    { cpu: 20, io: 50 }
  ];

  for (const workload of workloads) {
    const start = performance.now();
    const result = await mixedWorkload(workload.cpu, workload.io);
    const end = performance.now();
    console.log(`  Fibonacci(${workload.cpu}) + Sleep(${workload.io}ms) = ${result} (${(end - start).toFixed(2)}ms)`);
  }

  console.timeEnd('Mixed workload');
}

// Run the benchmark
runTaskBenchmark().catch(err => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
