/**
 * Worker script for the AdaptiveWorkerPool
 *
 * This script handles task execution in a worker thread.
 */

import { parentPort, workerData } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';

// Initialize worker
const workerId = workerData?.id || 0;

// Send ready message to parent
parentPort.postMessage({
  type: 'ready',
  workerId
});

// Handle messages from parent
parentPort.on('message', async (message) => {
  if (!message || typeof message !== 'object') {
    return sendError('Invalid message format');
  }

  const { type, taskId, data } = message;

  if (type === 'task') {
    try {
      // Start measuring performance
      const startTime = performance.now();
      const startCpuUsage = process.cpuUsage();
      const startMemUsage = process.memoryUsage();

      // Execute the task based on its type
      let result;
      switch (data.type) {
        case 'fibonacci':
          result = fibonacci(data.data);
          break;
        case 'sleep':
          result = await sleep(data.data);
          break;
        case 'mixed':
          result = await mixedWorkload(data.data[0], data.data[1]);
          break;
        default:
          throw new Error(`Unknown task type: ${data.type}`);
      }

      // Calculate metrics
      const endTime = performance.now();
      const cpuUsage = process.cpuUsage(startCpuUsage);
      const memUsage = process.memoryUsage();

      // Send result back to parent
      parentPort.postMessage({
        type: 'result',
        taskId,
        result,
        metrics: {
          executionTime: endTime - startTime,
          cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000,
          memoryUsage: memUsage.heapUsed - startMemUsage.heapUsed,
          workerId,
          wasStolen: false
        }
      });
    } catch (error) {
      sendError(error.message, taskId);
    }
  } else if (type === 'terminate') {
    // Clean up and exit
    process.exit(0);
  }
});

// Helper function to send error messages
function sendError(errorMessage, taskId = null) {
  parentPort.postMessage({
    type: 'error',
    taskId,
    error: errorMessage
  });
}

// Task implementations

// Fibonacci calculation (CPU-intensive)
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Sleep function (IO-bound)
function sleep(ms) {
  return new Promise(resolve => setTimeout(() => resolve(ms), ms));
}

// Mixed workload
async function mixedWorkload(cpuIntensity, ioTime) {
  // CPU work
  const fibResult = fibonacci(cpuIntensity);

  // IO work
  await sleep(ioTime);

  return fibResult;
}
