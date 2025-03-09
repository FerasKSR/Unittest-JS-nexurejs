/**
 * Adaptive Worker Pool Performance Benchmark for NexureJS
 *
 * This benchmark tests the performance of the adaptive worker pool
 * under different workloads and configurations.
 */

import { Benchmark, BenchmarkSuite } from '../src/utils/performance-benchmark.js';
import { AdaptiveWorkerPool, WorkerTask } from '../src/concurrency/adaptive-worker-pool.js';
import { v8Optimizer } from '../src/utils/v8-optimizer.js';
import { cpus } from 'node:os';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

// CPU-intensive task: calculate fibonacci numbers recursively
function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// IO-bound task simulation: sleep for a given time
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Mixed workload task
async function mixedWorkload(cpuIntensity: number, ioTime: number): Promise<number> {
  // CPU work
  const fibResult = fibonacci(cpuIntensity);

  // IO work
  await sleep(ioTime);

  return fibResult;
}

// Create a task object
function createTask<T, R>(type: string, data: T, cpuIntensity = 0.5): WorkerTask<T, R> {
  return {
    id: randomUUID(),
    type,
    data,
    cpuIntensity,
    stealable: true
  };
}

// Helper function to wait for a specified time
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the benchmarks
async function runBenchmarks() {
  console.log('Starting Adaptive Worker Pool Performance Benchmarks');

  // Get number of available CPUs
  const numCpus = cpus().length;
  console.log(`Running on a system with ${numCpus} CPU cores`);

  // Worker script path
  const workerScriptPath = join(process.cwd(), 'src/concurrency/worker.js');

  // 1. Worker Pool Scaling Benchmark
  const scalingSuite = new BenchmarkSuite({
    name: 'Worker Pool Scaling',
    description: 'Testing how the worker pool scales with different workloads',
    baseOptions: {
      iterations: 50,
      warmup: 5,
      collectMemoryStats: true,
      collectCpuStats: true,
      timeBudget: 10000 // 10 seconds per benchmark
    }
  });

  // Create different worker pool configurations
  const fixedPoolSmall = new AdaptiveWorkerPool({
    minWorkers: 2,
    maxWorkers: 2,
    maxIdleTime: 10000,
    checkInterval: 5000,
    scaleUpThreshold: 0.8,
    scaleDownThreshold: 0.2,
    taskQueueSize: 1000,
    workerScript: workerScriptPath
  });

  const fixedPoolLarge = new AdaptiveWorkerPool({
    minWorkers: numCpus,
    maxWorkers: numCpus,
    maxIdleTime: 10000,
    checkInterval: 5000,
    scaleUpThreshold: 0.8,
    scaleDownThreshold: 0.2,
    taskQueueSize: 1000,
    workerScript: workerScriptPath
  });

  const adaptivePool = new AdaptiveWorkerPool({
    minWorkers: 2,
    maxWorkers: numCpus,
    maxIdleTime: 1000,
    checkInterval: 100, // Adapt quickly
    scaleUpThreshold: 0.7,
    scaleDownThreshold: 0.3,
    taskQueueSize: 1000,
    workerScript: workerScriptPath
  });

  // Add benchmarks for CPU-intensive tasks
  scalingSuite.add(async () => {
    const tasks = Array.from({ length: numCpus }, () => {
      return fixedPoolSmall.executeTask(createTask('fibonacci', 35, 0.9));
    });

    await Promise.all(tasks);
  }, {
    name: 'Fixed Small Pool - CPU Tasks',
    description: `Fixed pool with 2 workers handling ${numCpus} CPU-intensive tasks`
  });

  scalingSuite.add(async () => {
    const tasks = Array.from({ length: numCpus }, () => {
      return fixedPoolLarge.executeTask(createTask('fibonacci', 35, 0.9));
    });

    await Promise.all(tasks);
  }, {
    name: 'Fixed Large Pool - CPU Tasks',
    description: `Fixed pool with ${numCpus} workers handling ${numCpus} CPU-intensive tasks`
  });

  scalingSuite.add(async () => {
    const tasks = Array.from({ length: numCpus }, () => {
      return adaptivePool.executeTask(createTask('fibonacci', 35, 0.9));
    });

    await Promise.all(tasks);
  }, {
    name: 'Adaptive Pool - CPU Tasks',
    description: `Adaptive pool handling ${numCpus} CPU-intensive tasks`
  });

  // Add benchmarks for IO-bound tasks - using batched execution to prevent queue overflow
  scalingSuite.add(async () => {
    // Execute in smaller batches to prevent queue overflow
    const batchSize = 2;
    const totalTasks = numCpus;

    for (let i = 0; i < totalTasks; i += batchSize) {
      const batchTasks = [];
      const currentBatchSize = Math.min(batchSize, totalTasks - i);

      for (let j = 0; j < currentBatchSize; j++) {
        batchTasks.push(fixedPoolSmall.executeTask(createTask('sleep', 50, 0.1)));
      }

      await Promise.all(batchTasks);
      // Add a small delay between batches to allow the worker pool to process tasks
      await wait(100);
    }
  }, {
    name: 'Fixed Small Pool - IO Tasks',
    description: `Fixed pool with 2 workers handling ${numCpus} IO-bound tasks in small batches`
  });

  scalingSuite.add(async () => {
    // Execute in smaller batches to prevent queue overflow
    const batchSize = 4;
    const totalTasks = numCpus;

    for (let i = 0; i < totalTasks; i += batchSize) {
      const batchTasks = [];
      const currentBatchSize = Math.min(batchSize, totalTasks - i);

      for (let j = 0; j < currentBatchSize; j++) {
        batchTasks.push(fixedPoolLarge.executeTask(createTask('sleep', 50, 0.1)));
      }

      await Promise.all(batchTasks);
      // Add a small delay between batches to allow the worker pool to process tasks
      await wait(100);
    }
  }, {
    name: 'Fixed Large Pool - IO Tasks',
    description: `Fixed pool with ${numCpus} workers handling ${numCpus} IO-bound tasks in small batches`
  });

  scalingSuite.add(async () => {
    // Execute in smaller batches to prevent queue overflow
    const batchSize = 4;
    const totalTasks = numCpus;

    for (let i = 0; i < totalTasks; i += batchSize) {
      const batchTasks = [];
      const currentBatchSize = Math.min(batchSize, totalTasks - i);

      for (let j = 0; j < currentBatchSize; j++) {
        batchTasks.push(adaptivePool.executeTask(createTask('sleep', 50, 0.1)));
      }

      await Promise.all(batchTasks);
      // Add a small delay between batches to allow the worker pool to process tasks
      await wait(100);
    }
  }, {
    name: 'Adaptive Pool - IO Tasks',
    description: `Adaptive pool handling ${numCpus} IO-bound tasks in small batches`
  });

  // Add benchmarks for mixed workload - using batched execution
  scalingSuite.add(async () => {
    // Execute in smaller batches to prevent queue overflow
    const batchSize = 2;
    const totalTasks = numCpus;

    for (let i = 0; i < totalTasks; i += batchSize) {
      const batchTasks = [];
      const currentBatchSize = Math.min(batchSize, totalTasks - i);

      for (let j = 0; j < currentBatchSize; j++) {
        const taskIndex = i + j;
        // Mix of CPU-intensive and IO-bound tasks
        const cpuIntensity = taskIndex % 3 === 0 ? 35 : 25;
        const ioTime = taskIndex % 2 === 0 ? 10 : 50;

        batchTasks.push(fixedPoolSmall.executeTask(
          createTask('mixed', [cpuIntensity, ioTime], taskIndex % 3 === 0 ? 0.8 : 0.4)
        ));
      }

      await Promise.all(batchTasks);
      // Add a small delay between batches to allow the worker pool to process tasks
      await wait(100);
    }
  }, {
    name: 'Fixed Small Pool - Mixed Workload',
    description: `Fixed pool with 2 workers handling ${numCpus} mixed tasks in small batches`
  });

  scalingSuite.add(async () => {
    // Execute in smaller batches to prevent queue overflow
    const batchSize = 4;
    const totalTasks = numCpus;

    for (let i = 0; i < totalTasks; i += batchSize) {
      const batchTasks = [];
      const currentBatchSize = Math.min(batchSize, totalTasks - i);

      for (let j = 0; j < currentBatchSize; j++) {
        const taskIndex = i + j;
        // Mix of CPU-intensive and IO-bound tasks
        const cpuIntensity = taskIndex % 3 === 0 ? 35 : 25;
        const ioTime = taskIndex % 2 === 0 ? 10 : 50;

        batchTasks.push(fixedPoolLarge.executeTask(
          createTask('mixed', [cpuIntensity, ioTime], taskIndex % 3 === 0 ? 0.8 : 0.4)
        ));
      }

      await Promise.all(batchTasks);
      // Add a small delay between batches to allow the worker pool to process tasks
      await wait(100);
    }
  }, {
    name: 'Fixed Large Pool - Mixed Workload',
    description: `Fixed pool with ${numCpus} workers handling ${numCpus} mixed tasks in small batches`
  });

  scalingSuite.add(async () => {
    // Execute in smaller batches to prevent queue overflow
    const batchSize = 4;
    const totalTasks = numCpus;

    for (let i = 0; i < totalTasks; i += batchSize) {
      const batchTasks = [];
      const currentBatchSize = Math.min(batchSize, totalTasks - i);

      for (let j = 0; j < currentBatchSize; j++) {
        const taskIndex = i + j;
        // Mix of CPU-intensive and IO-bound tasks
        const cpuIntensity = taskIndex % 3 === 0 ? 35 : 25;
        const ioTime = taskIndex % 2 === 0 ? 10 : 50;

        batchTasks.push(adaptivePool.executeTask(
          createTask('mixed', [cpuIntensity, ioTime], taskIndex % 3 === 0 ? 0.8 : 0.4)
        ));
      }

      await Promise.all(batchTasks);
      // Add a small delay between batches to allow the worker pool to process tasks
      await wait(100);
    }
  }, {
    name: 'Adaptive Pool - Mixed Workload',
    description: `Adaptive pool handling ${numCpus} mixed tasks in small batches`
  });

  // Run scaling benchmarks
  const scalingResults = await scalingSuite.run();

  // Compare results
  console.log(scalingSuite.compareResults('Fixed Small Pool - CPU Tasks', 'Fixed Large Pool - CPU Tasks', scalingResults));
  console.log(scalingSuite.compareResults('Fixed Small Pool - CPU Tasks', 'Adaptive Pool - CPU Tasks', scalingResults));
  console.log(scalingSuite.compareResults('Fixed Large Pool - CPU Tasks', 'Adaptive Pool - CPU Tasks', scalingResults));

  console.log(scalingSuite.compareResults('Fixed Small Pool - IO Tasks', 'Fixed Large Pool - IO Tasks', scalingResults));
  console.log(scalingSuite.compareResults('Fixed Small Pool - IO Tasks', 'Adaptive Pool - IO Tasks', scalingResults));
  console.log(scalingSuite.compareResults('Fixed Large Pool - IO Tasks', 'Adaptive Pool - IO Tasks', scalingResults));

  console.log(scalingSuite.compareResults('Fixed Small Pool - Mixed Workload', 'Fixed Large Pool - Mixed Workload', scalingResults));
  console.log(scalingSuite.compareResults('Fixed Small Pool - Mixed Workload', 'Adaptive Pool - Mixed Workload', scalingResults));
  console.log(scalingSuite.compareResults('Fixed Large Pool - Mixed Workload', 'Adaptive Pool - Mixed Workload', scalingResults));

  scalingSuite.saveResults(scalingResults);

  // 2. Worker Pool Throughput Benchmark
  const throughputSuite = new BenchmarkSuite({
    name: 'Worker Pool Throughput',
    description: 'Testing maximum throughput of different worker pool configurations',
    baseOptions: {
      iterations: 5,
      warmup: 2,
      collectMemoryStats: true,
      collectCpuStats: true,
      timeBudget: 5000 // 5 seconds per benchmark
    }
  });

  // Create a high-throughput worker pool
  const highThroughputPool = new AdaptiveWorkerPool({
    minWorkers: numCpus,
    maxWorkers: numCpus * 2,
    maxIdleTime: 30000,
    checkInterval: 1000,
    scaleUpThreshold: 0.9,
    scaleDownThreshold: 0.1,
    taskQueueSize: 10000,
    workerScript: workerScriptPath
  });

  // Add throughput benchmarks
  throughputSuite.add(async () => {
    const numTasks = 50; // Reduced from 100 to prevent queue overflow
    const batchSize = 10;

    for (let i = 0; i < numTasks; i += batchSize) {
      const batchTasks = [];
      const currentBatchSize = Math.min(batchSize, numTasks - i);

      for (let j = 0; j < currentBatchSize; j++) {
        const taskIndex = i + j;
        batchTasks.push(highThroughputPool.executeTask(
          createTask('fibonacci', 20 + (taskIndex % 10), 0.9)
        ));
      }

      await Promise.all(batchTasks);
      // Add a small delay between batches
      await wait(100);
    }
  }, {
    name: 'High Throughput - CPU Tasks',
    description: `High throughput pool handling 50 CPU-intensive tasks in small batches`
  });

  throughputSuite.add(async () => {
    const numTasks = 100; // Reduced from 200 to prevent queue overflow
    const batchSize = 20;

    for (let i = 0; i < numTasks; i += batchSize) {
      const batchTasks = [];
      const currentBatchSize = Math.min(batchSize, numTasks - i);

      for (let j = 0; j < currentBatchSize; j++) {
        const taskIndex = i + j;
        batchTasks.push(highThroughputPool.executeTask(
          createTask('sleep', 5 + (taskIndex % 10), 0.1)
        ));
      }

      await Promise.all(batchTasks);
      // Add a small delay between batches
      await wait(100);
    }
  }, {
    name: 'High Throughput - IO Tasks',
    description: `High throughput pool handling 100 IO-bound tasks in small batches`
  });

  throughputSuite.add(async () => {
    const numTasks = 75; // Reduced from 150 to prevent queue overflow
    const batchSize = 15;

    for (let i = 0; i < numTasks; i += batchSize) {
      const batchTasks = [];
      const currentBatchSize = Math.min(batchSize, numTasks - i);

      for (let j = 0; j < currentBatchSize; j++) {
        const taskIndex = i + j;
        // Mix of CPU-intensive and IO-bound tasks
        const cpuIntensity = 15 + (taskIndex % 10);
        const ioTime = 5 + (taskIndex % 10);

        batchTasks.push(highThroughputPool.executeTask(
          createTask('mixed', [cpuIntensity, ioTime], 0.8)
        ));
      }

      await Promise.all(batchTasks);
      // Add a small delay between batches
      await wait(100);
    }
  }, {
    name: 'High Throughput - Mixed Workload',
    description: `High throughput pool handling 75 mixed tasks in small batches`
  });

  // Run throughput benchmarks
  const throughputResults = await throughputSuite.run();

  // Compare results
  console.log(throughputSuite.compareResults('High Throughput - CPU Tasks', 'High Throughput - IO Tasks', throughputResults));
  console.log(throughputSuite.compareResults('High Throughput - CPU Tasks', 'High Throughput - Mixed Workload', throughputResults));
  console.log(throughputSuite.compareResults('High Throughput - IO Tasks', 'High Throughput - Mixed Workload', throughputResults));

  throughputSuite.saveResults(throughputResults);

  // Shutdown all worker pools
  await Promise.all([
    fixedPoolSmall.shutdown(),
    fixedPoolLarge.shutdown(),
    adaptivePool.shutdown(),
    highThroughputPool.shutdown()
  ]);

  console.log('All benchmarks completed');
}

// Run the benchmarks
runBenchmarks().catch(err => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
