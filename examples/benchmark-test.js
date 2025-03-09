/**
 * Benchmark test application for NexureJS
 */

import { Benchmark, BenchmarkSuite } from '../src/utils/performance-benchmark.js';
import { v8Optimizer } from '../src/utils/v8-optimizer.js';

console.log('Starting NexureJS Benchmark Test');

// Function to benchmark
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

// Object creation benchmark
async function runObjectCreationBenchmark() {
  console.log('\nRunning Object Creation Benchmark');

  const suite = new BenchmarkSuite({
    name: 'Object Creation',
    description: 'Comparing standard vs optimized object creation',
    baseOptions: {
      iterations: 10000,
      warmup: 1000
    }
  });

  // Standard object creation
  suite.add(() => {
    const obj = {
      id: 1,
      name: 'Test Object',
      value: Math.random(),
      created: new Date().toISOString()
    };
    return obj;
  }, {
    name: 'Standard Object Creation',
    description: 'Creating objects with standard object literals'
  });

  // Optimized object creation
  suite.add(() => {
    const obj = v8Optimizer.createOptimizedObject({
      id: 1,
      name: 'Test Object',
      value: Math.random(),
      created: new Date().toISOString()
    });
    return obj;
  }, {
    name: 'Optimized Object Creation',
    description: 'Creating objects with optimized object patterns'
  });

  // Run the benchmark
  const results = await suite.run();

  // Compare results
  console.log(suite.compareResults('Standard Object Creation', 'Optimized Object Creation', results));

  // Save results
  suite.saveResults(results);
}

// Function benchmark
async function runFunctionBenchmark() {
  console.log('\nRunning Function Benchmark');

  const suite = new BenchmarkSuite({
    name: 'Function Optimization',
    description: 'Comparing standard vs optimized functions',
    baseOptions: {
      iterations: 100,
      warmup: 10
    }
  });

  // Standard function
  suite.add(() => {
    return fibonacci(15);
  }, {
    name: 'Standard Function',
    description: 'Standard recursive fibonacci implementation'
  });

  // Optimized function
  suite.add(() => {
    return optimizedFibonacci(15);
  }, {
    name: 'Optimized Function',
    description: 'Optimized recursive fibonacci implementation'
  });

  // Run the benchmark
  const results = await suite.run();

  // Compare results
  console.log(suite.compareResults('Standard Function', 'Optimized Function', results));

  // Save results
  suite.saveResults(results);
}

// Array benchmark
async function runArrayBenchmark() {
  console.log('\nRunning Array Benchmark');

  const suite = new BenchmarkSuite({
    name: 'Array Operations',
    description: 'Comparing standard vs optimized array operations',
    baseOptions: {
      iterations: 1000,
      warmup: 100
    }
  });

  // Standard array
  suite.add(() => {
    const arr = [];
    for (let i = 0; i < 1000; i++) {
      arr.push(i);
    }

    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
      sum += arr[i];
    }
    return sum;
  }, {
    name: 'Standard Array',
    description: 'Standard array operations'
  });

  // Optimized array
  suite.add(() => {
    const arr = v8Optimizer.createFastArray(1000, 'number');
    for (let i = 0; i < 1000; i++) {
      arr[i] = i;
    }

    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
      sum += arr[i];
    }
    return sum;
  }, {
    name: 'Optimized Array',
    description: 'Optimized array operations'
  });

  // Run the benchmark
  const results = await suite.run();

  // Compare results
  console.log(suite.compareResults('Standard Array', 'Optimized Array', results));

  // Save results
  suite.saveResults(results);
}

// Run all benchmarks
async function runAllBenchmarks() {
  try {
    await runObjectCreationBenchmark();
    await runFunctionBenchmark();
    await runArrayBenchmark();

    console.log('\nAll benchmarks completed successfully!');
    console.log('Results saved to the benchmark-results directory.');
  } catch (error) {
    console.error('Error running benchmarks:', error);
    process.exit(1);
  }
}

// Run the benchmarks
runAllBenchmarks();
