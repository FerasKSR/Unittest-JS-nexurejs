/**
 * Type definitions for the AdaptiveWorkerPool
 */

export interface WorkerPoolOptions {
  minWorkers?: number;
  maxWorkers?: number;
  startWorkers?: boolean;
  maxIdleTime?: number;
  checkInterval?: number;
  scaleUpThreshold?: number;
  scaleDownThreshold?: number;
  taskQueueSize?: number;
  workerOptions?: any;
  workerScript: string;
}

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

export class AdaptiveWorkerPool<TData = any, TResult = any> {
  constructor(options: WorkerPoolOptions);

  executeTask(task: WorkerTask<TData, TResult>): Promise<TResult>;

  shutdown(): Promise<void>;
}
