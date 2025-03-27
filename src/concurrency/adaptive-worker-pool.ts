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
import { performance } from 'node:perf_hooks';
import { setTimeout, clearTimeout } from 'node:timers';
import { Logger } from '../utils/logger';

// Task to be executed by a worker
export interface WorkerTask<TData = any, _TResult = any> {
  id: string;
  type: string;
  data: TData;
  priority?: number;
  cpuIntensity?: number;
  memoryRequirement?: number;
  timeout?: number;
  stealable?: boolean;
  queueTime?: number; // Timestamp when task was added to queue
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
  'pool:high-priority-scaling': (taskCount: number) => void;
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
  cpuUsage: number; // Added for CPU tracking
  memoryUsage: number; // Added for memory tracking
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

  // Request pattern history for predictive scaling
  private requestPatterns: {
    timestamp: number;
    taskCount: number;
    taskTypes: Record<string, number>;
    avgExecutionTime: number;
  }[] = [];

  // Performance metrics for detailed monitoring
  private performanceMetrics = {
    workerUtilization: [] as number[],
    queueWaitTimes: [] as number[],
    responseLatencies: [] as number[],
    taskThroughput: 0,
    lastThroughputTime: Date.now(),
    taskThroughputHistory: [] as {timestamp: number, value: number}[],
    cpuUtilizationHistory: [] as {timestamp: number, value: number}[],
    predictedLoad: 0
  };

  // Options with defaults
  private readonly options: Required<WorkerPoolOptions & {
    // Additional options for enhanced scaling
    predictiveScaling?: boolean;
    patternHistorySize?: number;
    utilizationSmoothingFactor?: number;
    scaleUpAggressiveness?: number;
    scaleDownCaution?: number;
    metricHistorySize?: number;
    throughputMeasurementInterval?: number;
    scalingCooldown?: number;
    highPriorityQueueThreshold?: number;
  }>;

  // Stats for monitoring and auto-scaling
  private stats = {
    tasksQueued: 0,
    tasksCompleted: 0,
    tasksRejected: 0,
    tasksTimedOut: 0,
    tasksErrors: 0,
    totalExecutionTime: 0,
    cpuUtilization: 0,
    waitTimeTotal: 0, // Total time tasks spent in queue
    lastMinuteTasks: 0,
    lastHourTasks: 0,
    recentTaskRates: [] as number[], // For tracking recent task rates
  };

  constructor(options: WorkerPoolOptions & {
    predictiveScaling?: boolean;
    patternHistorySize?: number;
    utilizationSmoothingFactor?: number;
    scaleUpAggressiveness?: number;
    scaleDownCaution?: number;
    metricHistorySize?: number;
    throughputMeasurementInterval?: number;
    scalingCooldown?: number;
    highPriorityQueueThreshold?: number;
  }) {
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
      workerScript: options.workerScript,

      // New advanced scaling options
      predictiveScaling: options.predictiveScaling ?? true,
      patternHistorySize: options.patternHistorySize ?? 20,
      utilizationSmoothingFactor: options.utilizationSmoothingFactor ?? 0.3,
      scaleUpAggressiveness: options.scaleUpAggressiveness ?? 1.5,
      scaleDownCaution: options.scaleDownCaution ?? 0.8,
      metricHistorySize: options.metricHistorySize ?? 50,
      throughputMeasurementInterval: options.throughputMeasurementInterval ?? 10000, // 10 seconds
      scalingCooldown: options.scalingCooldown ?? 5000, // 5 seconds
      highPriorityQueueThreshold: options.highPriorityQueueThreshold ?? 10
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

    // Start throughput measurement
    this.startThroughputMeasurement();
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
        cpuUsage: 0,
        memoryUsage: 0,
        pendingTasks: new Map()
      };

      // Setup message handler
      worker.on('message', (message: {
        id: string,
        result?: TResult,
        error?: Error,
        metrics?: {
          cpuUsage: number,
          memoryUsage: number
        }
      }) => {
        const pendingTask = workerStatus.pendingTasks.get(message.id);

        if (pendingTask) {
          // Clear timeout if exists
          if (pendingTask.timer) {
            clearTimeout(pendingTask.timer);
          }

          // Calculate execution time
          const endTime = performance.now();
          const executionTime = endTime - pendingTask.startTime;

          // Update resource usage metrics
          if (message.metrics) {
            workerStatus.cpuUsage = message.metrics.cpuUsage;
            workerStatus.memoryUsage = message.metrics.memoryUsage;
          }

          // Update worker stats
          workerStatus.tasksProcessed++;
          workerStatus.lastTaskTime = Date.now();
          workerStatus.busy = false;
          workerStatus.cumulativeTaskTime += executionTime;
          workerStatus.pendingTasks.delete(message.id);

          // Update pool stats
          this.stats.tasksCompleted++;
          this.stats.totalExecutionTime += executionTime;

          // Record task execution for pattern analysis
          this.recordTaskExecution(pendingTask.task.type, executionTime);

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
                cpuUsage: workerStatus.cpuUsage,
                memoryUsage: workerStatus.memoryUsage,
                workerId: id,
                wasStolen: false
              }
            });

            // Record response latency for metrics
            this.performanceMetrics.responseLatencies.push(executionTime);
            this.maintainMetricHistory(this.performanceMetrics.responseLatencies);
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

    // Sort tasks by priority if present
    if (task.priority) {
      // Find insertion point based on priority (higher priority first)
      const index = this.taskQueue.findIndex(t =>
        (t.priority || 0) < (task.priority || 0)
      );

      if (index >= 0) {
        this.taskQueue.splice(index, 0, task);
      } else {
        this.taskQueue.push(task);
      }
    } else {
      // Add task to queue
      this.taskQueue.push(task);
    }

    this.stats.tasksQueued++;

    // Record task arrival for workload prediction
    this.stats.recentTaskRates.push(Date.now());
    if (this.stats.recentTaskRates.length > 100) {
      this.stats.recentTaskRates.shift();
    }

    // Process queue
    this.processQueue();

    return task.id;
  }

  // Process tasks from the queue
  private processQueue(): void {
    // Find available workers
    const availableWorkers = this.workers.filter(w => !w.busy);

    // Check if we have high priority tasks that need more workers
    const highPriorityTasks = this.taskQueue.filter(t => (t.priority || 0) > this.options.highPriorityQueueThreshold);

    // Preemptively scale up if we have high priority tasks
    if (highPriorityTasks.length > 0 && availableWorkers.length < highPriorityTasks.length) {
      this.emit('pool:high-priority-scaling', highPriorityTasks.length);
      this.scaleUp('High priority tasks in queue');
    }

    // Process tasks - assign to least busy workers first
    while (this.taskQueue.length > 0 && availableWorkers.length > 0) {
      const task = this.taskQueue.shift()!;

      // Find the worker with the lowest CPU usage
      availableWorkers.sort((a, b) => a.cpuUsage - b.cpuUsage);
      const worker = availableWorkers.shift()!;

      // Calculate wait time for metrics
      const waitTime = Date.now() - (task.queueTime || Date.now());
      this.stats.waitTimeTotal += waitTime;
      this.performanceMetrics.queueWaitTimes.push(waitTime);
      this.maintainMetricHistory(this.performanceMetrics.queueWaitTimes);

      this.assignTaskToWorker(worker, task);
    }

    // Scale up if queue has tasks but no available workers
    if (this.taskQueue.length > 0 && availableWorkers.length === 0) {
      const reason = this.taskQueue.length > 5 ?
        `Queue backed up with ${this.taskQueue.length} tasks` :
        'No available workers';
      this.scaleUp(reason);
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

  // Monitor worker pool and scale adaptively
  private async monitorAndScale(): Promise<void> {
    if (this.scalingLock || this.isShuttingDown) {
      return;
    }

    this.scalingLock = true;

    try {
      // Calculate pool metrics
      const totalWorkers = this.workers.length;
      const busyWorkers = this.workers.filter(w => w.busy).length;

      // Calculate weighted utilization using smoothing factor
      const instantUtilization = totalWorkers === 0 ? 0 : busyWorkers / totalWorkers;
      const previousUtilization = this.stats.cpuUtilization;
      const smoothedUtilization = (this.options.utilizationSmoothingFactor * instantUtilization) +
                                 ((1 - this.options.utilizationSmoothingFactor) * previousUtilization);

      // Store CPU utilization for stats and history
      this.stats.cpuUtilization = smoothedUtilization;
      this.performanceMetrics.workerUtilization.push(smoothedUtilization);
      this.performanceMetrics.cpuUtilizationHistory.push({
        timestamp: Date.now(),
        value: smoothedUtilization
      });

      // Maintain history
      this.maintainMetricHistory(this.performanceMetrics.workerUtilization);
      this.maintainMetricHistory(this.performanceMetrics.cpuUtilizationHistory);

      // Predict future load if enabled
      if (this.options.predictiveScaling) {
        this.predictWorkload();
      }

      // Calculate current task rate
      const _recentTaskRate = this.calculateRecentTaskRate();

      // Scale based on both current utilization and predicted load
      const effectiveUtilization = this.options.predictiveScaling ?
        Math.max(smoothedUtilization, this.performanceMetrics.predictedLoad) :
        smoothedUtilization;

      // Aggressive scale up if we're above threshold
      if (effectiveUtilization >= this.options.scaleUpThreshold) {
        // Calculate how many workers to add based on aggressiveness factor
        const workersToAdd = Math.max(1, Math.ceil(
          (effectiveUtilization - this.options.scaleUpThreshold) *
          totalWorkers * this.options.scaleUpAggressiveness
        ));

        this.scaleUpBy(workersToAdd, `High utilization: ${effectiveUtilization.toFixed(2)}`);
      }
      // Cautious scale down if we're below threshold
      else if (effectiveUtilization <= this.options.scaleDownThreshold) {
        // Check for idle workers
        const now = Date.now();
        const idleThreshold = now - this.options.maxIdleTime;

        // Find idle workers to terminate
        const idleWorkers = this.workers
          .filter(w => !w.busy && w.lastTaskTime < idleThreshold)
          .sort((a, b) => a.tasksProcessed - b.tasksProcessed); // Terminate least used workers first

        // Scale down if we have idle workers and are above minimum
        // Apply caution factor to prevent aggressive scaling down
        const workersToRemove = Math.min(
          idleWorkers.length,
          Math.floor((totalWorkers - this.options.minWorkers) * this.options.scaleDownCaution)
        );

        if (workersToRemove > 0) {
          for (let i = 0; i < workersToRemove; i++) {
            if (i < idleWorkers.length) {
              await this.terminateWorker(idleWorkers[i].id);
            }
          }

          // Emit scaling event
          this.emit('pool:scaled-down', this.workers.length,
            `Low utilization: ${effectiveUtilization.toFixed(2)}, removed ${workersToRemove} workers`);
        }
      }
    } finally {
      this.scalingLock = false;
    }
  }

  // Calculate recent task rate (tasks per second)
  private calculateRecentTaskRate(): number {
    const now = Date.now();
    const recentWindow = 60000; // 1 minute window

    // Count tasks in the last minute
    const recentTasks = this.stats.recentTaskRates.filter(time => now - time < recentWindow).length;

    // Calculate tasks per second
    return recentTasks / (recentWindow / 1000);
  }

  // Predict future workload based on patterns
  private predictWorkload(): void {
    if (this.requestPatterns.length < 5) {
      return; // Not enough data to predict
    }

    // Look for time-of-day patterns
    const now = new Date();
    const hourOfDay = now.getHours();
    const dayOfWeek = now.getDay();

    // Find similar patterns from history (same hour, similar day of week)
    const similarPatterns = this.requestPatterns.filter(pattern => {
      const patternDate = new Date(pattern.timestamp);
      return patternDate.getHours() === hourOfDay &&
             (patternDate.getDay() === dayOfWeek ||
              Math.abs(patternDate.getDay() - dayOfWeek) === 1); // Same day or adjacent day
    });

    if (similarPatterns.length > 0) {
      // Calculate average task rate during similar times
      const totalTasks = similarPatterns.reduce((sum, pattern) => sum + pattern.taskCount, 0);
      const avgTaskRate = totalTasks / similarPatterns.length;

      // Calculate recent task rate
      const recentTaskRate = this.calculateRecentTaskRate();

      // Calculate trend (increasing or decreasing)
      const trend = recentTaskRate > avgTaskRate ? 1.1 : 0.9;

      // Predict load based on historical patterns and recent trend
      this.performanceMetrics.predictedLoad = Math.min(1.0,
        (avgTaskRate / this.workers.length) * trend
      );
    }
  }

  // Scale up the worker pool with a reason
  private scaleUp(reason: string = 'Auto-scaling'): void {
    this.scaleUpBy(1, reason);
  }

  // Scale up by a specific number of workers
  private scaleUpBy(count: number, reason: string = 'Auto-scaling'): void {
    const currentWorkerCount = this.workers.length;

    // Check if we can scale up
    const availableSlots = this.options.maxWorkers - currentWorkerCount;
    if (availableSlots <= 0) {
      return;
    }

    // Check scaling cooldown
    const now = Date.now();
    if (now - this.lastScalingAction < this.options.scalingCooldown) {
      return;
    }

    // Limit count to available slots
    const workersToAdd = Math.min(count, availableSlots);

    // Create workers
    for (let i = 0; i < workersToAdd; i++) {
      this.createWorker();
    }

    this.lastScalingAction = now;

    // Emit scaling event
    this.emit('pool:scaled-up', this.workers.length,
      `${reason} - Added ${workersToAdd} workers, new size: ${this.workers.length}`);
  }

  // Start measuring task throughput
  private startThroughputMeasurement(): void {
    setInterval(() => {
      if (this.isShuttingDown) return;

      const now = Date.now();
      const elapsed = (now - this.performanceMetrics.lastThroughputTime) / 1000; // in seconds

      // Calculate tasks per second
      this.performanceMetrics.taskThroughput = this.stats.tasksCompleted / elapsed;

      // Record for history
      this.performanceMetrics.taskThroughputHistory.push({
        timestamp: now,
        value: this.performanceMetrics.taskThroughput
      });

      // Maintain history size
      this.maintainMetricHistory(this.performanceMetrics.taskThroughputHistory);

      // Reset counter for next interval
      this.stats.tasksCompleted = 0;
      this.performanceMetrics.lastThroughputTime = now;

    }, this.options.throughputMeasurementInterval);
  }

  // Record task execution for pattern analysis
  private recordTaskExecution(taskType: string, executionTime: number): void {
    const now = Date.now();

    // Create new pattern record
    const patternRecord = {
      timestamp: now,
      taskCount: 1,
      taskTypes: { [taskType]: 1 },
      avgExecutionTime: executionTime
    };

    // Add to history
    this.requestPatterns.push(patternRecord);

    // Maintain history size
    if (this.requestPatterns.length > this.options.patternHistorySize) {
      this.requestPatterns.shift();
    }
  }

  // Maintain metric history to the configured size
  private maintainMetricHistory<T>(history: T[]): void {
    if (history.length > this.options.metricHistorySize) {
      history.splice(0, history.length - this.options.metricHistorySize);
    }
  }

  // Get enhanced pool status with metrics
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
      avgWaitTime: number,
      throughput: number,
      predictedLoad: number,
      cpuUtilization: number
    },
    metrics: {
      workerUtilization: number[],
      queueWaitTimes: number[],
      responseLatencies: number[],
      taskThroughputHistory: {timestamp: number, value: number}[],
      cpuUtilizationHistory: {timestamp: number, value: number}[]
    }
  } {
    const totalWorkers = this.workers.length;
    const busyWorkers = this.workers.filter(w => w.busy).length;
    const totalTasksCompleted = this.workers.reduce((sum, w) => sum + w.tasksProcessed, 0);

    return {
      workers: totalWorkers,
      busy: busyWorkers,
      idle: totalWorkers - busyWorkers,
      queueSize: this.taskQueue.length,
      stats: {
        tasksProcessed: totalTasksCompleted,
        tasksSucceeded: totalTasksCompleted - this.stats.tasksErrors,
        tasksFailed: this.stats.tasksErrors,
        avgExecutionTime: this.stats.tasksCompleted > 0 ?
          this.stats.totalExecutionTime / this.stats.tasksCompleted : 0,
        avgWaitTime: this.stats.tasksCompleted > 0 ?
          this.stats.waitTimeTotal / this.stats.tasksCompleted : 0,
        throughput: this.performanceMetrics.taskThroughput,
        predictedLoad: this.performanceMetrics.predictedLoad,
        cpuUtilization: this.stats.cpuUtilization
      },
      metrics: {
        workerUtilization: this.performanceMetrics.workerUtilization,
        queueWaitTimes: this.performanceMetrics.queueWaitTimes,
        responseLatencies: this.performanceMetrics.responseLatencies,
        taskThroughputHistory: this.performanceMetrics.taskThroughputHistory,
        cpuUtilizationHistory: this.performanceMetrics.cpuUtilizationHistory
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
