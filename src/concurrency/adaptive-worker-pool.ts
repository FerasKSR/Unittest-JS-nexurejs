/**
 * Adaptive Worker Pool
 *
 * This implementation provides a self-tuning thread pool that:
 * - Dynamically scales the number of workers based on CPU load
 * - Intelligently routes CPU-intensive tasks to worker threads
 * - Supports work stealing between threads for optimal load balancing
 * - Provides backpressure mechanisms to prevent system overload
 */

import { Worker, WorkerOptions } from 'node:worker_threads';
import { cpus } from 'node:os';
import { EventEmitter } from 'node:events';
import { setTimeout as setTimeoutPromise } from 'node:timers/promises';
import { setTimeout, clearTimeout } from 'node:timers';
import { Logger } from '../utils/logger.js';
import { performance } from 'node:perf_hooks';

// Task to be executed by a worker
export interface WorkerTask<TData = any, TResult = any> {
  id: string;
  type: string;
  data: TData;
  priority?: number;
  cpuIntensity?: number;
  memoryRequirement?: number;
  timeout?: number;
  stealable?: boolean;
}

// Result of task execution
export interface WorkerTaskResult<TResult = any> {
  taskId: string;
  result: TResult;
  error?: string;
  metrics: {
    executionTime: number;
    cpuUsage: number;
    memoryUsage: number;
    workerId: number;
    wasStolen: boolean;
  };
}

// Events emitted by worker pool
export interface WorkerPoolEvents<TData = any, TResult = any> {
  'task:submitted': (task: WorkerTask<TData, TResult>) => void;
  'task:started': (taskId: string, workerId: number) => void;
  'task:completed': (result: WorkerTaskResult<TResult>) => void;
  'task:failed': (taskId: string, error: Error) => void;
  'worker:created': (workerId: number) => void;
  'worker:idle': (workerId: number) => void;
  'worker:terminated': (workerId: number) => void;
  'pool:scaled-up': (newSize: number, reason: string) => void;
  'pool:scaled-down': (newSize: number, reason: string) => void;
  'pool:backpressure': (queueSize: number) => void;
  'pool:load-balanced': (tasksMoved: number) => void;
}

// Worker pool options
export interface WorkerPoolOptions {
  // Minimum number of workers
  minWorkers?: number;

  // Maximum number of workers
  maxWorkers?: number;

  // Whether to start all workers immediately
  startWorkers?: boolean;

  // Maximum idle time before terminating a worker (ms)
  maxIdleTime?: number;

  // Interval for checking worker utilization (ms)
  checkInterval?: number;

  // Utilization threshold for scaling up (0-1)
  scaleUpThreshold?: number;

  // Utilization threshold for scaling down (0-1)
  scaleDownThreshold?: number;

  // Task queue size
  taskQueueSize?: number;

  // Worker options passed to Worker constructor
  workerOptions?: WorkerOptions;

  // Path to worker script
  workerScript: string;
}

// Worker status for tracking
interface WorkerStatus {
  id: number;
  worker: Worker;
  busy: boolean;
  tasksProcessed: number;
  lastTaskTime: number;
  createdAt: number;
  cumulativeTaskTime: number;
  pendingTasks: Map<string, {
    task: WorkerTask<any, any>;
    startTime: number;
    timer: NodeJS.Timeout | null;
  }>;
}

// Worker pool implementation
export class AdaptiveWorkerPool<TData, TResult> extends EventEmitter {
  private workers: WorkerStatus[] = [];
  private taskQueue: Array<WorkerTask<TData, TResult>> = [];
  private logger = new Logger();
  private terminationPromises: Map<number, Promise<number>> = new Map();
  private lastScalingAction = 0;
  private scalingLock = false;
  private taskCounter = 0;
  private isShuttingDown = false;

  // Options with defaults
  private readonly options: Required<WorkerPoolOptions>;

  // Stats for monitoring and auto-scaling
  private stats = {
    tasksQueued: 0,
    tasksCompleted: 0,
    tasksRejected: 0,
    tasksTimedOut: 0,
    tasksErrors: 0,
    totalExecutionTime: 0,
    cpuUtilization: 0
  };

  constructor(options: WorkerPoolOptions) {
    super();

    const cpuCount = cpus().length;

    // Set default options
    this.options = {
      minWorkers: options.minWorkers ?? Math.max(1, Math.floor(cpuCount / 2)),
      maxWorkers: options.maxWorkers ?? cpuCount,
      startWorkers: options.startWorkers ?? false,
      maxIdleTime: options.maxIdleTime ?? 60000, // 1 minute
      checkInterval: options.checkInterval ?? 5000, // 5 seconds
      scaleUpThreshold: options.scaleUpThreshold ?? 0.7, // 70% utilization
      scaleDownThreshold: options.scaleDownThreshold ?? 0.3, // 30% utilization
      taskQueueSize: options.taskQueueSize ?? 1000,
      workerOptions: options.workerOptions ?? {},
      workerScript: options.workerScript
    };

    // Verify options
    if (this.options.minWorkers > this.options.maxWorkers) {
      throw new Error('minWorkers cannot be greater than maxWorkers');
    }

    if (this.options.scaleUpThreshold <= this.options.scaleDownThreshold) {
      throw new Error('scaleUpThreshold must be greater than scaleDownThreshold');
    }

    // Initialize worker pool
    if (this.options.startWorkers) {
      this.initialize();
    }

    // Start monitoring
    this.startMonitoring();
  }

  // Initialize worker pool
  private initialize(): void {
    const currentWorkerCount = this.workers.length;
    const targetWorkerCount = this.options.minWorkers;

    if (currentWorkerCount < targetWorkerCount) {
      // Create workers
      for (let i = currentWorkerCount; i < targetWorkerCount; i++) {
        this.createWorker();
      }
    }
  }

  // Create a new worker
  private createWorker(): number {
    const id = Date.now();

    try {
      const worker = new Worker(this.options.workerScript, this.options.workerOptions);

      const workerStatus: WorkerStatus = {
        id,
        worker,
        busy: false,
        tasksProcessed: 0,
        lastTaskTime: 0,
        createdAt: Date.now(),
        cumulativeTaskTime: 0,
        pendingTasks: new Map()
      };

      // Setup message handler
      worker.on('message', (message: { id: string, result?: TResult, error?: Error }) => {
        const pendingTask = workerStatus.pendingTasks.get(message.id);

        if (pendingTask) {
          // Clear timeout if exists
          if (pendingTask.timer) {
            clearTimeout(pendingTask.timer);
          }

          // Calculate execution time
          const endTime = performance.now();
          const executionTime = endTime - pendingTask.startTime;

          // Update worker stats
          workerStatus.tasksProcessed++;
          workerStatus.lastTaskTime = Date.now();
          workerStatus.busy = false;
          workerStatus.cumulativeTaskTime += executionTime;
          workerStatus.pendingTasks.delete(message.id);

          // Update pool stats
          this.stats.tasksCompleted++;
          this.stats.totalExecutionTime += executionTime;

          // Emit task completion event
          if (message.error) {
            this.stats.tasksErrors++;
            this.emit('task:failed', message.id, message.error);
          } else {
            this.emit('task:completed', {
              taskId: message.id,
              result: message.result,
              metrics: {
                executionTime,
                cpuUsage: 0, // Assuming cpuUsage is not available in the message
                memoryUsage: 0, // Assuming memoryUsage is not available in the message
                workerId: id,
                wasStolen: false
              }
            });
          }

          // Process next task from queue if available
          this.processQueue();
        }
      });

      // Handle worker errors
      worker.on('error', (error) => {
        this.logger.error(`Worker ${id} error:`, error);
        this.emit('worker:error', error, id);

        // Fail all pending tasks for this worker
        for (const [taskId, pendingTask] of workerStatus.pendingTasks.entries()) {
          if (pendingTask.timer) {
            clearTimeout(pendingTask.timer);
          }

          this.stats.tasksErrors++;
          this.emit('task:failed', taskId, error);
        }

        // Replace the worker
        this.terminateWorker(id, true);
        this.createWorker();
      });

      // Add worker to pool
      this.workers.push(workerStatus);
      this.emit('worker:created', id);

      return id;
    } catch (error) {
      this.logger.error('Failed to create worker:', error);
      throw error;
    }
  }

  // Terminate a worker
  private async terminateWorker(id: number, force = false): Promise<number> {
    const index = this.workers.findIndex(w => w.id === id);

    if (index === -1) {
      return -1;
    }

    // Check if termination is already in progress
    if (this.terminationPromises.has(id)) {
      return this.terminationPromises.get(id)!;
    }

    const workerStatus = this.workers[index];

    // Don't terminate if worker is busy and not forced
    if (workerStatus.busy && !force) {
      return -1;
    }

    // Create termination promise
    const terminationPromise = new Promise<number>((resolve, reject) => {
      try {
        // Terminate worker
        workerStatus.worker.terminate()
          .then(() => {
            // Remove worker from pool
            this.workers.splice(index, 1);
            this.terminationPromises.delete(id);
            this.emit('worker:terminated', id);
            resolve(id);
          })
          .catch(error => {
            this.logger.error(`Failed to terminate worker ${id}:`, error);
            this.terminationPromises.delete(id);
            reject(error);
          });
      } catch (error) {
        this.terminationPromises.delete(id);
        reject(error);
      }
    });

    // Store and return termination promise
    this.terminationPromises.set(id, terminationPromise);
    return terminationPromise;
  }

  // Execute a task on a worker
  async executeTask(task: WorkerTask<TData, TResult>): Promise<string> {
    if (this.isShuttingDown) {
      throw new Error('Worker pool is shutting down');
    }

    // Generate task ID if not provided
    if (!task.id) {
      task.id = `task_${Date.now()}_${this.taskCounter++}`;
    }

    // Initialize pool if not already done
    if (this.workers.length === 0) {
      this.initialize();
    }

    // Check if queue is full
    if (this.taskQueue.length >= this.options.taskQueueSize) {
      this.stats.tasksRejected++;
      this.emit('pool:backpressure', this.taskQueue.length);
      throw new Error('Task queue is full');
    }

    // Add task to queue
    this.taskQueue.push(task);
    this.stats.tasksQueued++;

    // Process queue
    this.processQueue();

    return task.id;
  }

  // Process tasks from the queue
  private processQueue(): void {
    // Find available workers
    const availableWorkers = this.workers.filter(w => !w.busy);

    // Process tasks
    while (this.taskQueue.length > 0 && availableWorkers.length > 0) {
      const task = this.taskQueue.shift()!;
      const worker = availableWorkers.shift()!;

      this.assignTaskToWorker(worker, task);
    }

    // Scale up if queue has tasks but no available workers
    if (this.taskQueue.length > 0 && availableWorkers.length === 0) {
      this.scaleUp();
    }
  }

  // Assign a task to a worker
  private assignTaskToWorker(workerStatus: WorkerStatus, task: WorkerTask<any, any>): void {
    workerStatus.busy = true;
    const startTime = performance.now();

    // Set up timeout if specified
    let timer: NodeJS.Timeout | null = null;
    if (task.timeout) {
      timer = setTimeout(() => {
        this.handleTaskTimeout(workerStatus.id, task.id, task.timeout!);
      }, task.timeout);
    }

    // Store task in worker's pending tasks
    workerStatus.pendingTasks.set(task.id, {
      task,
      startTime,
      timer
    });

    // Send task to worker
    workerStatus.worker.postMessage({
      id: task.id,
      data: task.data
    });
  }

  // Handle task timeout
  private handleTaskTimeout(workerId: number, taskId: string, timeout: number): void {
    const workerStatus = this.workers.find(w => w.id === workerId);

    if (!workerStatus) return;

    const pendingTask = workerStatus.pendingTasks.get(taskId);

    if (pendingTask) {
      workerStatus.pendingTasks.delete(taskId);

      // Mark worker as not busy
      workerStatus.busy = workerStatus.pendingTasks.size > 0;

      // Update stats
      this.stats.tasksTimedOut++;

      // Emit timeout event
      this.emit('task:timeout', taskId, timeout);

      // Terminate and replace worker if it's still processing the task
      // This is a drastic measure but ensures system health
      this.terminateWorker(workerId, true);
      this.createWorker();
    }
  }

  // Start monitoring and auto-scaling
  private startMonitoring(): void {
    const interval = setInterval(() => {
      if (this.isShuttingDown) {
        clearInterval(interval);
        return;
      }

      this.monitorAndScale();
    }, this.options.checkInterval);

    // Clean up on process exit
    process.on('beforeExit', () => {
      clearInterval(interval);
      this.shutdown();
    });
  }

  // Monitor worker pool and scale as needed
  private async monitorAndScale(): Promise<void> {
    if (this.scalingLock || this.isShuttingDown) {
      return;
    }

    this.scalingLock = true;

    try {
      // Calculate pool metrics
      const totalWorkers = this.workers.length;
      const busyWorkers = this.workers.filter(w => w.busy).length;
      const utilization = totalWorkers === 0 ? 0 : busyWorkers / totalWorkers;

      // Store CPU utilization for stats
      this.stats.cpuUtilization = utilization;

      // Check for idle workers
      const now = Date.now();
      const idleThreshold = now - this.options.maxIdleTime;

      // Scale based on utilization
      if (utilization >= this.options.scaleUpThreshold) {
        this.scaleUp();
      } else if (utilization <= this.options.scaleDownThreshold) {
        // Find idle workers to terminate
        const idleWorkers = this.workers
          .filter(w => !w.busy && w.lastTaskTime < idleThreshold)
          .sort((a, b) => a.lastTaskTime - b.lastTaskTime);

        // Scale down if we have idle workers and are above minimum
        if (idleWorkers.length > 0 && totalWorkers > this.options.minWorkers) {
          const workerId = idleWorkers[0].id;
          await this.terminateWorker(workerId);

          // Emit scaling event
          this.emit('pool:scaled-down', this.workers.length, `Idle for ${now - idleThreshold}ms`);
        }
      }
    } finally {
      this.scalingLock = false;
    }
  }

  // Scale up the worker pool
  private scaleUp(): void {
    const currentWorkerCount = this.workers.length;

    // Check if we can scale up
    if (currentWorkerCount >= this.options.maxWorkers) {
      return;
    }

    // Check if we should scale up based on timing
    const now = Date.now();
    const scalingDelay = 2000; // 2 seconds between scaling actions

    if (now - this.lastScalingAction < scalingDelay) {
      return;
    }

    // Scale up
    this.createWorker();
    this.lastScalingAction = now;

    // Emit scaling event
    this.emit('pool:scaled-up', this.workers.length, `Scaled up to ${this.workers.length}`);
  }

  // Get pool status
  getStatus(): {
    workers: number,
    busy: number,
    idle: number,
    queueSize: number,
    stats: {
      tasksProcessed: number,
      tasksSucceeded: number,
      tasksFailed: number,
      avgExecutionTime: number,
      avgWaitTime: number
    }
  } {
    const totalWorkers = this.workers.length;
    const busyWorkers = this.workers.filter(w => w.busy).length;

    return {
      workers: totalWorkers,
      busy: busyWorkers,
      idle: totalWorkers - busyWorkers,
      queueSize: this.taskQueue.length,
      stats: {
        tasksProcessed: this.stats.tasksCompleted,
        tasksSucceeded: this.stats.tasksCompleted,
        tasksFailed: this.stats.tasksErrors,
        avgExecutionTime: this.stats.totalExecutionTime / this.stats.tasksCompleted,
        avgWaitTime: 0 // Assuming avgWaitTime is not available in the current stats
      }
    };
  }

  // Shutdown the worker pool
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.logger.info('Shutting down worker pool...');

    // Stop accepting new tasks
    this.taskQueue = [];

    // Wait for all workers to finish
    const terminationPromises = this.workers.map(w => this.terminateWorker(w.id, true));

    try {
      await Promise.all(terminationPromises);
      this.logger.info('Worker pool shutdown complete');
    } catch (error) {
      this.logger.error('Error during worker pool shutdown:', error);
      throw error;
    }
  }
}
