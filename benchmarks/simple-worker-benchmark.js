/**
 * Simple Worker Pool Benchmark for NexureJS
 *
 * This is a simplified benchmark that tests the basic functionality
 * of the adaptive worker pool without running into task queue issues.
 */

import { AdaptiveWorkerPool } from '../src/concurrency/adaptive-worker-pool.ts';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { cpus } from 'node:os';

// Helper function to wait for a specified time
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// CPU-intensive task: calculate fibonacci numbers recursively
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// IO-bound task simulation: sleep for a given time
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Create a task object
function createTask(type, data, cpuIntensity = 0.5) {
  return {
    id: randomUUID(),
    type,
    data,
    cpuIntensity,
    stealable: true
  };
}

// Run a simple benchmark
async function runSimpleBenchmark() {
  console.log('Starting Simple Worker Pool Benchmark');

  // Get number of available CPUs
  const numCpus = cpus().length;
  console.log(`Running on a system with ${numCpus} CPU cores`);

  // Worker script path
  const workerScriptPath = join(process.cwd(), 'src/concurrency/worker.js');

  // Create worker pools
  const smallPool = new AdaptiveWorkerPool({
    minWorkers: 2,
    maxWorkers: 2,
    maxIdleTime: 10000,
    checkInterval: 5000,
    scaleUpThreshold: 0.8,
    scaleDownThreshold: 0.2,
    taskQueueSize: 100,
    workerScript: workerScriptPath
  });

  const adaptivePool = new AdaptiveWorkerPool({
    minWorkers: 2,
    maxWorkers: numCpus,
    maxIdleTime: 1000,
    checkInterval: 100,
    scaleUpThreshold: 0.7,
    scaleDownThreshold: 0.3,
    taskQueueSize: 100,
    workerScript: workerScriptPath
  });

  try {
    // Test 1: CPU-intensive tasks on small pool
    console.log('\nTest 1: CPU-intensive tasks on small pool (2 workers)');
    console.time('Small pool - CPU tasks');

    const cpuTasks1 = [];
    for (let i = 0; i < 4; i++) {
      cpuTasks1.push(smallPool.executeTask(createTask('fibonacci', 35, 0.9)));
    }

    await Promise.all(cpuTasks1);
    console.timeEnd('Small pool - CPU tasks');

    // Test 2: CPU-intensive tasks on adaptive pool
    console.log('\nTest 2: CPU-intensive tasks on adaptive pool (2-8 workers)');
    console.time('Adaptive pool - CPU tasks');

    const cpuTasks2 = [];
    for (let i = 0; i < 8; i++) {
      cpuTasks2.push(adaptivePool.executeTask(createTask('fibonacci', 35, 0.9)));
    }

    await Promise.all(cpuTasks2);
    console.timeEnd('Adaptive pool - CPU tasks');

    // Test 3: IO-bound tasks on small pool
    console.log('\nTest 3: IO-bound tasks on small pool (2 workers)');
    console.time('Small pool - IO tasks');

    // Run in batches to prevent queue overflow
    for (let batch = 0; batch < 2; batch++) {
      const ioTasks1 = [];
      for (let i = 0; i < 2; i++) {
        ioTasks1.push(smallPool.executeTask(createTask('sleep', 100, 0.1)));
      }
      await Promise.all(ioTasks1);
    }

    console.timeEnd('Small pool - IO tasks');

    // Test 4: IO-bound tasks on adaptive pool
    console.log('\nTest 4: IO-bound tasks on adaptive pool (2-8 workers)');
    console.time('Adaptive pool - IO tasks');

    // Run in batches to prevent queue overflow
    for (let batch = 0; batch < 2; batch++) {
      const ioTasks2 = [];
      for (let i = 0; i < 4; i++) {
        ioTasks2.push(adaptivePool.executeTask(createTask('sleep', 100, 0.1)));
      }
      await Promise.all(ioTasks2);
    }

    console.timeEnd('Adaptive pool - IO tasks');

    // Test 5: Mixed workload on adaptive pool
    console.log('\nTest 5: Mixed workload on adaptive pool (2-8 workers)');
    console.time('Adaptive pool - Mixed workload');

    const mixedTasks = [];
    for (let i = 0; i < 8; i++) {
      // Alternate between CPU and IO tasks
      if (i % 2 === 0) {
        mixedTasks.push(adaptivePool.executeTask(createTask('fibonacci', 30, 0.8)));
      } else {
        mixedTasks.push(adaptivePool.executeTask(createTask('sleep', 50, 0.2)));
      }
    }

    await Promise.all(mixedTasks);
    console.timeEnd('Adaptive pool - Mixed workload');

  } catch (err) {
    console.error('Benchmark error:', err);
  } finally {
    // Shutdown worker pools
    console.log('\nShutting down worker pools...');
    await Promise.all([
      smallPool.shutdown(),
      adaptivePool.shutdown()
    ]);
    console.log('All worker pools shut down');
  }
}

// Run the benchmark
runSimpleBenchmark().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
