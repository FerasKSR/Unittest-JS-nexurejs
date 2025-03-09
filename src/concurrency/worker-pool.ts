/**
 * Worker pool for CPU-intensive tasks
 */

import { Worker } from 'node:worker_threads';
import { cpus } from 'node:os';
import { EventEmitter } from 'node:events';
import { Logger } from '../utils/logger.js';

/**
 * Worker task
 */
export interface WorkerTask<T = any, R = any> {
  /**
   * Task ID
   */
  id: string;

  /**
   * Task data
   */
  data: T;

  /**
   * Task type
   */
  type: string;
}

/**
 * Worker result
 */
export interface WorkerResult<R = any> {
  /**
   * Task ID
   */
  taskId: string;

  /**
   * Result data
   */
  data: R;

  /**
   * Error message (if any)
   */
  error?: string;
}

/**
 * Worker pool options
 */
export interface WorkerPoolOptions {
  /**
   * Number of workers
   * @default Number of CPU cores
   */
  numWorkers?: number;

  /**
   * Worker script path
   */
  workerScript: string;

  /**
   * Worker initialization data
   */
  workerData?: any;

  /**
   * Task timeout in milliseconds
   * @default 30000 (30 seconds)
   */
  taskTimeout?: number;
}

/**
 * Worker pool for CPU-intensive tasks
 */
export class WorkerPool extends EventEmitter {
  private workers: Worker[] = [];
  private workerScript: string;
  private workerData: any;
  private taskQueue: WorkerTask[] = [];
  private taskCallbacks = new Map<string, {
    resolve: (result: any) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }>();
  private taskTimeout: number;
  private logger = new Logger();
  private isShuttingDown = false;

  /**
   * Create a new worker pool
   * @param options Worker pool options
   */
  constructor(options: WorkerPoolOptions) {
    super();

    const numWorkers = options.numWorkers || cpus().length;
    this.workerScript = options.workerScript;
    this.workerData = options.workerData || {};
    this.taskTimeout = options.taskTimeout || 30000;

    this.logger.info(`Creating worker pool with ${numWorkers} workers`);

    // Create workers
    for (let i = 0; i < numWorkers; i++) {
      this.addWorker();
    }
  }

  /**
   * Add a worker to the pool
   */
  private addWorker(): void {
    try {
      const worker = new Worker(this.workerScript, {
        workerData: this.workerData
      });

      worker.on('message', (result: WorkerResult) => {
        this.handleWorkerResult(result);
      });

      worker.on('error', (error) => {
        this.logger.error(`Worker error: ${error.message}`);

        // Remove the worker from the pool
        const index = this.workers.indexOf(worker);
        if (index !== -1) {
          this.workers.splice(index, 1);
        }

        // Add a new worker if not shutting down
        if (!this.isShuttingDown) {
          this.addWorker();
        }
      });

      worker.on('exit', (code) => {
        this.logger.info(`Worker exited with code ${code}`);

        // Remove the worker from the pool
        const index = this.workers.indexOf(worker);
        if (index !== -1) {
          this.workers.splice(index, 1);
        }

        // Add a new worker if not shutting down
        if (!this.isShuttingDown) {
          this.addWorker();
        }
      });

      this.workers.push(worker);

      // Process any pending tasks
      this.processPendingTasks();
    } catch (error) {
      this.logger.error(`Failed to create worker: ${(error as Error).message}`);
    }
  }

  /**
   * Handle a worker result
   * @param result The worker result
   */
  private handleWorkerResult(result: WorkerResult): void {
    const callback = this.taskCallbacks.get(result.taskId);

    if (!callback) {
      this.logger.warn(`Received result for unknown task: ${result.taskId}`);
      return;
    }

    // Clear the timeout
    clearTimeout(callback.timer);

    // Remove the callback
    this.taskCallbacks.delete(result.taskId);

    // Handle the result
    if (result.error) {
      callback.reject(new Error(result.error));
    } else {
      callback.resolve(result.data);
    }

    // Process any pending tasks
    this.processPendingTasks();
  }

  /**
   * Process pending tasks
   */
  private processPendingTasks(): void {
    // Find an available worker
    const availableWorker = this.workers.find(worker => {
      return worker.threadId !== undefined;
    });

    if (!availableWorker || this.taskQueue.length === 0) {
      return;
    }

    // Get the next task
    const task = this.taskQueue.shift();

    if (!task) {
      return;
    }

    // Send the task to the worker
    availableWorker.postMessage(task);
  }

  /**
   * Execute a task on a worker
   * @param type The task type
   * @param data The task data
   */
  async executeTask<T = any, R = any>(type: string, data: T): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      // Create a task ID
      const taskId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create a task
      const task: WorkerTask<T> = {
        id: taskId,
        type,
        data
      };

      // Create a timeout
      const timer = setTimeout(() => {
        // Remove the callback
        this.taskCallbacks.delete(taskId);

        // Reject the promise
        reject(new Error(`Task ${taskId} timed out after ${this.taskTimeout}ms`));
      }, this.taskTimeout);

      // Store the callback
      this.taskCallbacks.set(taskId, {
        resolve,
        reject,
        timer
      });

      // Add the task to the queue
      this.taskQueue.push(task);

      // Process pending tasks
      this.processPendingTasks();
    });
  }

  /**
   * Shutdown the worker pool
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Terminate all workers
    const terminationPromises = this.workers.map(worker => {
      return worker.terminate();
    });

    // Wait for all workers to terminate
    await Promise.all(terminationPromises);

    // Clear the task queue
    this.taskQueue = [];

    // Reject all pending tasks
    for (const [taskId, callback] of this.taskCallbacks.entries()) {
      clearTimeout(callback.timer);
      callback.reject(new Error('Worker pool is shutting down'));
      this.taskCallbacks.delete(taskId);
    }

    this.logger.info('Worker pool shutdown complete');
  }
}
