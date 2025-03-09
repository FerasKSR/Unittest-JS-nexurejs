# NexureJS Benchmarking Guide

This guide explains how to run and interpret performance benchmarks for the NexureJS framework.

## Table of Contents

1. [Introduction](#introduction)
2. [Available Benchmarks](#available-benchmarks)
3. [Running Benchmarks](#running-benchmarks)
4. [Benchmark Runner Tools](#benchmark-runner-tools)
5. [Interpreting Results](#interpreting-results)
6. [Creating Custom Benchmarks](#creating-custom-benchmarks)
7. [Troubleshooting](#troubleshooting)

## Introduction

NexureJS includes a comprehensive benchmarking suite to measure and compare the performance of various components and optimizations. These benchmarks help you:

- Understand the performance characteristics of different NexureJS components
- Compare optimization strategies
- Evaluate the impact of your modifications to the codebase
- Make informed decisions about which features to use in your applications

## Available Benchmarks

NexureJS includes the following benchmark types:

### HTTP Benchmarks (`benchmarks/http-benchmark.ts`)

Tests the performance of routing and HTTP parsing components:
- Standard Radix Router vs. Optimized Radix Router
- HTTP request parsing
- End-to-end request handling

### JSON Benchmarks (`benchmarks/json-benchmark.ts`)

Tests JSON serialization and deserialization performance:
- Standard JSON vs. Optimized JSON handling
- Large payload processing
- Streaming JSON processing

### Worker Pool Benchmarks (`benchmarks/worker-pool-benchmark.ts`)

Tests the performance of the adaptive worker pool:
- Fixed-size vs. adaptive worker pools
- CPU-intensive tasks
- I/O-bound tasks
- Mixed workloads

### V8 Optimizer Benchmarks (`benchmarks/v8-optimizer-benchmark.ts`)

Tests V8 engine optimizations:
- Function optimization
- Object creation
- Property access
- Monomorphic vs. polymorphic code paths

### Simple Benchmarks

Simple benchmarks for testing and comparison purposes:
- `benchmarks/simple-benchmark.ts`: TypeScript version
- `benchmarks/simple-benchmark.js`: JavaScript version
- `benchmarks/simple-js-benchmark.js`: Pure JavaScript version with no dependencies

## Running Benchmarks

NexureJS provides multiple ways to run benchmarks to accommodate different environments and use cases.

### Using NPM Scripts

The simplest way to run benchmarks is using the predefined npm scripts:

```bash
# Run all benchmarks
npm run benchmark

# Run specific benchmarks
npm run benchmark:http
npm run benchmark:json
npm run benchmark:worker
npm run benchmark:v8
npm run benchmark:simple
npm run benchmark:simple:js
```

### Using the TypeScript Runner

You can run any TypeScript benchmark directly using the TypeScript runner:

```bash
# General syntax
node run-typescript.js <path-to-typescript-file>

# Examples
node run-typescript.js benchmarks/http-benchmark.ts
node run-typescript.js benchmarks/custom-benchmark.ts
```

### Using Shell Scripts

For Unix-based systems, you can use the provided shell scripts:

```bash
# Run TypeScript files directly
./run-ts.sh benchmarks/http-benchmark.ts

# Transpile to JavaScript first, then run
./run-ts-bench.sh benchmarks/worker-pool-benchmark.ts
```

## Benchmark Runner Tools

NexureJS includes several tools to facilitate running TypeScript benchmarks in an ESM environment:

### `run-typescript.js`

A Node.js script that properly configures the environment for running TypeScript files with ESM support:

```bash
node run-typescript.js <file.ts>
```

This script:
- Sets up the proper Node.js options for ts-node
- Configures TypeScript to use ESM modules
- Uses the ESM-specific TypeScript configuration
- Handles errors gracefully

### `run-ts.sh`

A shell script for Unix-based systems to run TypeScript files directly:

```bash
./run-ts.sh <file.ts>
```

### `run-ts-bench.sh`

A shell script that transpiles TypeScript to JavaScript first, then runs the resulting JavaScript file:

```bash
./run-ts-bench.sh <file.ts>
```

This approach:
- Creates a temporary directory for the transpiled JavaScript
- Uses TypeScript compiler with proper options
- Runs the transpiled JavaScript
- Cleans up temporary files after execution

### TypeScript Configuration

When running benchmarks, NexureJS uses a specific ESM-compatible TypeScript configuration (`tsconfig.esm.json`) that properly handles ESM modules.

## Interpreting Results

Benchmark results are output to the console and saved to JSON files in the `benchmark-results` directory with a timestamp. Each benchmark provides:

### Performance Metrics

- **Operations per second**: How many iterations were completed per second
- **Average time**: Average time per operation in milliseconds
- **Percentile latency**: How long operations took at various percentiles (p50, p95, p99)

### Comparison Metrics

When comparing different implementations, the benchmarks provide:

- **Time ratio**: Ratio of the average times (< 1.0 means the first implementation is slower)
- **Ops/sec ratio**: Ratio of the operations per second (< 1.0 means the first implementation performs fewer operations)

### Memory and CPU Usage

For benchmarks that collect resource usage statistics:

- **Memory usage**: Baseline, peak, and growth during the benchmark
- **CPU usage**: User and system CPU time during the benchmark

## Creating Custom Benchmarks

You can create your own benchmarks using the built-in benchmarking utilities:

```typescript
import { Benchmark, BenchmarkSuite } from '../src/utils/performance-benchmark.js';

// Create a benchmark suite
const suite = new BenchmarkSuite({
  name: 'My Custom Benchmark',
  description: 'Testing custom functionality',
  baseOptions: {
    iterations: 1000,
    warmup: 100,
    collectMemoryStats: true
  }
});

// Add benchmarks to the suite
suite.add(() => {
  // Standard implementation
  // ...your code here...
}, {
  name: 'Standard Implementation'
});

suite.add(() => {
  // Optimized implementation
  // ...your code here...
}, {
  name: 'Optimized Implementation'
});

// Run the benchmarks
const results = await suite.run();

// Compare results
console.log(suite.compareResults(
  'Standard Implementation',
  'Optimized Implementation',
  results
));

// Save results to a file
suite.saveResults(results);
```

For JavaScript-only benchmarks, you can use a simpler approach:

```javascript
import { performance } from 'node:perf_hooks';

async function runBenchmark() {
  console.log('Starting benchmark...');

  // Test 1: Standard implementation
  console.time('Standard implementation');
  // ...your code here...
  console.timeEnd('Standard implementation');

  // Test 2: Optimized implementation
  console.time('Optimized implementation');
  // ...your code here...
  console.timeEnd('Optimized implementation');
}

runBenchmark().catch(console.error);
```

## Troubleshooting

### TypeScript Loading Issues

If you encounter issues loading TypeScript files, try these solutions:

1. Use the `run-typescript.js` script which is specifically designed to handle ESM TypeScript files:
   ```bash
   node run-typescript.js your-file.ts
   ```

2. Use the transpiling approach with `run-ts-bench.sh`:
   ```bash
   ./run-ts-bench.sh your-file.ts
   ```

### Worker Pool Task Queue Errors

If you get "Task queue is full" errors with worker pool benchmarks:

1. Reduce the number of concurrent tasks
2. Increase the task queue size in the worker pool options
3. Use batched execution with smaller batches and delays between batches

### Memory Issues

For benchmarks that process large amounts of data:

1. Increase the Node.js heap size:
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" npm run benchmark
   ```

2. Use the streaming versions of benchmarks where available
3. Reduce the number of iterations or the data size

### Inconsistent Results

If you're getting inconsistent benchmark results:

1. Close other applications consuming CPU or memory
2. Run the benchmark multiple times and average the results
3. Increase the number of iterations and warmup cycles
4. Consider system power management settings that might throttle CPU
