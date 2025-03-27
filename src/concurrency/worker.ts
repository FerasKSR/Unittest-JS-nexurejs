/**
 * Worker script for the AdaptiveWorkerPool
 *
 * This script handles task execution in a worker thread.
 */

import { parentPort, workerData } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';

// Define types for messages and tasks
interface WorkerData {
  id: number;
}

interface TaskMessage {
  type: 'task';
  taskId: string;
  data: TaskData;
}

interface TerminateMessage {
  type: 'terminate';
}

type WorkerMessage = TaskMessage | TerminateMessage;

interface TaskData {
  type: 'fibonacci' | 'sleep' | 'mixed';
  data: number | number[] | any;
}

interface ResultMetrics {
  executionTime: number;
  cpuUsage: number;
  memoryUsage: number;
  workerId: number;
  wasStolen: boolean;
}

interface ResultMessage {
  type: 'result';
  taskId: string;
  result: any;
  metrics: ResultMetrics;
}

interface ErrorMessage {
  type: 'error';
  taskId: string | null;
  error: string;
}

interface ReadyMessage {
  type: 'ready';
  workerId: number;
}

// Initialize worker
const workerId = (workerData as WorkerData)?.id || 0;

// Send ready message to parent
parentPort!.postMessage({
  type: 'ready',
  workerId
} as ReadyMessage);

// Handle messages from parent
parentPort!.on('message', async (message: WorkerMessage) => {
  if (!message || typeof message !== 'object') {
    return sendError('Invalid message format');
  }

  if (message.type === 'task') {
    const { taskId, data } = message;

    try {
      // Start measuring performance
      const startTime = performance.now();
      const startCpuUsage = process.cpuUsage();
      const startMemUsage = process.memoryUsage();

      // Execute the task based on its type
      let result;
      switch (data.type) {
        case 'fibonacci':
          result = fibonacci(data.data as number);
          break;
        case 'sleep':
          result = await sleep(data.data as number);
          break;
        case 'mixed':
          const mixedData = data.data as number[];
          result = await mixedWorkload(mixedData[0], mixedData[1]);
          break;
        default:
          throw new Error(`Unknown task type: ${(data as any).type}`);
      }

      // Calculate metrics
      const endTime = performance.now();
      const cpuUsage = process.cpuUsage(startCpuUsage);
      const memUsage = process.memoryUsage();

      // Send result back to parent
      parentPort!.postMessage({
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
      } as ResultMessage);
    } catch (error) {
      sendError((error as Error).message, taskId);
    }
  } else if (message.type === 'terminate') {
    // Clean up and exit
    process.exit(0);
  }
});

// Helper function to send error messages
function sendError(errorMessage: string, taskId: string | null = null): void {
  parentPort!.postMessage({
    type: 'error',
    taskId,
    error: errorMessage
  } as ErrorMessage);
}

// Task implementations

// Fibonacci calculation (CPU-intensive)
function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Sleep function (IO-bound)
function sleep(ms: number): Promise<number> {
  return new Promise(resolve => setTimeout(() => resolve(ms), ms));
}

// Mixed workload
async function mixedWorkload(cpuIntensity: number, ioTime: number): Promise<number> {
  // CPU work
  const fibResult = fibonacci(cpuIntensity);

  // IO work
  await sleep(ioTime);

  return fibResult;
}
