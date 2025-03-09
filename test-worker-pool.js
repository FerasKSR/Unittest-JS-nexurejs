/**
 * Simple test script for the AdaptiveWorkerPool
 */

import { AdaptiveWorkerPool } from './src/concurrency/adaptive-worker-pool.ts';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

// Create a worker pool
const pool = new AdaptiveWorkerPool({
  minWorkers: 2,
  maxWorkers: 4,
  maxIdleTime: 10000,
  checkInterval: 5000,
  scaleUpThreshold: 0.8,
  scaleDownThreshold: 0.2,
  taskQueueSize: 100,
  workerScript: join(process.cwd(), 'src/concurrency/worker.js')
});

// Create a task
function createTask(type, data) {
  return {
    id: randomUUID(),
    type,
    data,
    cpuIntensity: 0.5,
    stealable: true
  };
}

// Run a simple test
async function runTest() {
  console.log('Testing AdaptiveWorkerPool...');

  try {
    // Execute a simple task
    console.log('Executing a simple task...');
    const result = await pool.executeTask(createTask('fibonacci', 30));
    console.log('Task result:', result);

    // Shutdown the pool
    console.log('Shutting down the worker pool...');
    await pool.shutdown();
    console.log('Worker pool shut down');
  } catch (err) {
    console.error('Test error:', err);
  }
}

// Run the test
runTest().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
