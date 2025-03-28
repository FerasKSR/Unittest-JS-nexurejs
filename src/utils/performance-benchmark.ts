/**
 * Performance Benchmarking Tool
 *
 * A comprehensive benchmarking utility for measuring code performance in NexureJS.
 * Allows developers to identify bottlenecks and optimize code.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { performance, PerformanceObserver } from 'node:perf_hooks';
import { v8Optimizer } from './v8-optimizer';

/**
 * Benchmark options
 */
export interface BenchmarkOptions {
  /** Name of the benchmark */
  name: string;
  /** Description of what's being benchmarked */
  description?: string;
  /** Number of iterations to run (default: 1000) */
  iterations?: number;
  /** Number of warmup iterations to run before measuring (default: 10) */
  warmup?: number;
  /** Time budget in ms (will stop after this time regardless of iterations) */
  timeBudget?: number;
  /** Whether to collect memory usage statistics */
  collectMemoryStats?: boolean;
  /** Whether to collect CPU usage statistics */
  collectCpuStats?: boolean;
  /** Whether to optimize the code before benchmarking */
  optimize?: boolean;
  /** Whether to use Node.js performance trace */
  usePerformanceTrace?: boolean;
}

/**
 * Benchmark result structure
 */
export interface BenchmarkResult {
  /** Name of the benchmark */
  name: string;
  /** Description of what was benchmarked */
  description?: string;
  /** Number of iterations that were run */
  iterations: number;
  /** Total time in milliseconds */
  totalTime: number;
  /** Average time per iteration in milliseconds */
  averageTime: number;
  /** Operations per second */
  opsPerSecond: number;
  /** Standard deviation of iteration times */
  stdDev: number;
  /** Margin of error (95% confidence) */
  marginOfError: number;
  /** Percentile results (50th, 90th, 95th, 99th) */
  percentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  /** Memory usage statistics (if collected) */
  memoryStats?: {
    before: NodeJS.MemoryUsage;
    after: NodeJS.MemoryUsage;
    diff: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
      arrayBuffers?: number;
    };
  };
  /** CPU usage statistics (if collected) */
  cpuStats?: {
    user: number;
    system: number;
  };
  /** When the benchmark was run */
  timestamp: string;
}

/**
 * Options for benchmark suite
 */
export interface BenchmarkSuiteOptions {
  /** Name of the benchmark suite */
  name: string;
  /** Description of the benchmark suite */
  description?: string;
  /** Whether to run benchmarks in sequence or parallel */
  parallel?: boolean;
  /** Base options for all benchmarks in the suite */
  baseOptions?: Partial<BenchmarkOptions>;
}

/**
 * Represents a single benchmark
 */
export class Benchmark {
  private name: string;
  private description?: string;
  private iterations: number;
  private warmup: number;
  private timeBudget?: number;
  private collectMemoryStats: boolean;
  private collectCpuStats: boolean;
  private optimize: boolean;
  private usePerformanceTrace: boolean;
  private fn: () => any;

  /**
   * Create a new benchmark
   * @param fn Function to benchmark
   * @param options Benchmark options
   */
  constructor(fn: () => any, options: BenchmarkOptions) {
    this.fn = fn;
    this.name = options.name;
    this.description = options.description;
    this.iterations = options.iterations || 1000;
    this.warmup = options.warmup || 10;
    this.timeBudget = options.timeBudget;
    this.collectMemoryStats = options.collectMemoryStats || false;
    this.collectCpuStats = options.collectCpuStats || false;
    this.optimize = options.optimize || false;
    this.usePerformanceTrace = options.usePerformanceTrace || false;

    if (this.optimize) {
      this.fn = v8Optimizer.optimizeFunction(this.fn);
    }
  }

  /**
   * Run the benchmark
   * @returns Benchmark results
   */
  async run(): Promise<BenchmarkResult> {
    console.log(`Running benchmark: ${this.name}`);

    // Record starting memory if needed
    let startMemory: NodeJS.MemoryUsage | undefined;
    if (this.collectMemoryStats) {
      startMemory = process.memoryUsage();
    }

    // Record starting CPU usage if needed
    let startCpu: NodeJS.CpuUsage | undefined;
    if (this.collectCpuStats) {
      startCpu = process.cpuUsage();
    }

    // Setup performance trace if enabled
    let observer: PerformanceObserver | undefined;
    if (this.usePerformanceTrace) {
      observer = new PerformanceObserver(list => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          console.log(`Trace: ${entry.name}: ${entry.duration}ms`);
        });
      });
      observer.observe({ entryTypes: ['measure'] });
    }

    // Warmup phase
    console.log(`Warming up for ${this.warmup} iterations...`);
    for (let i = 0; i < this.warmup; i++) {
      await this.fn();
    }

    // Measure phase
    console.log(`Running ${this.iterations} iterations...`);
    const times: number[] = [];
    const startTime = performance.now();
    let iteration = 0;

    if (this.timeBudget) {
      // If we have a time budget, run until we hit it
      const endTime = startTime + this.timeBudget;

      while (performance.now() < endTime && iteration < this.iterations) {
        const iterStart = performance.now();
        await this.fn();
        times.push(performance.now() - iterStart);
        iteration++;
      }
    } else {
      // Otherwise run for fixed number of iterations
      for (let i = 0; i < this.iterations; i++) {
        const iterStart = performance.now();
        await this.fn();
        times.push(performance.now() - iterStart);
        iteration++;
      }
    }

    const totalTime = performance.now() - startTime;

    // Calculate statistics
    times.sort((a, b) => a - b);
    const actualIterations = times.length;
    const avgTime = totalTime / actualIterations;
    const opsPerSecond = Math.round(1000 / avgTime);

    // Calculate standard deviation
    const sumDiffSquared = times.reduce((sum, time) => {
      const diff = time - avgTime;
      return sum + diff * diff;
    }, 0);
    const stdDev = Math.sqrt(sumDiffSquared / actualIterations);

    // Calculate margin of error (95% confidence)
    const marginOfError = 1.96 * (stdDev / Math.sqrt(actualIterations));

    // Calculate percentiles
    const p50 = this.percentile(times, 0.5);
    const p90 = this.percentile(times, 0.9);
    const p95 = this.percentile(times, 0.95);
    const p99 = this.percentile(times, 0.99);

    // End performance tracing
    if (observer) {
      observer.disconnect();
    }

    // Record final memory and CPU usage
    let memoryStats;
    if (this.collectMemoryStats && startMemory) {
      const endMemory = process.memoryUsage();
      memoryStats = {
        before: startMemory,
        after: endMemory,
        diff: {
          rss: endMemory.rss - startMemory.rss,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          external: endMemory.external - startMemory.external,
          arrayBuffers:
            endMemory.arrayBuffers && startMemory.arrayBuffers
              ? endMemory.arrayBuffers - startMemory.arrayBuffers
              : undefined
        }
      };
    }

    let cpuStats;
    if (this.collectCpuStats && startCpu) {
      const endCpu = process.cpuUsage(startCpu);
      cpuStats = {
        user: endCpu.user / 1000, // Convert to ms
        system: endCpu.system / 1000 // Convert to ms
      };
    }

    // Create result object
    const result: BenchmarkResult = {
      name: this.name,
      description: this.description,
      iterations: actualIterations,
      totalTime,
      averageTime: avgTime,
      opsPerSecond,
      stdDev,
      marginOfError,
      percentiles: {
        p50,
        p90,
        p95,
        p99
      },
      memoryStats,
      cpuStats,
      timestamp: new Date().toISOString()
    };

    console.log(`Completed benchmark: ${this.name}`);
    console.log(`  Average time: ${avgTime.toFixed(4)}ms`);
    console.log(`  Operations/second: ${opsPerSecond.toLocaleString()}`);

    return result;
  }

  /**
   * Calculate a percentile value from an array of numbers
   * @param values Sorted array of values
   * @param percentile Percentile to calculate (0-1)
   * @returns The percentile value
   */
  private percentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const index = Math.max(0, Math.min(Math.floor(percentile * values.length), values.length - 1));

    return values[index]!;
  }
}

/**
 * A suite of benchmarks to run together
 */
export class BenchmarkSuite {
  private name: string;
  private description?: string;
  private parallel: boolean;
  private baseOptions: Partial<BenchmarkOptions>;
  private benchmarks: Benchmark[] = [];

  /**
   * Create a new benchmark suite
   * @param options Suite options
   */
  constructor(options: BenchmarkSuiteOptions) {
    this.name = options.name;
    this.description = options.description;
    this.parallel = options.parallel || false;
    this.baseOptions = options.baseOptions || {};
  }

  /**
   * Add a benchmark to the suite
   * @param fn Function to benchmark
   * @param options Benchmark options
   * @returns This suite for chaining
   */
  add(fn: () => any, options: Partial<BenchmarkOptions>): BenchmarkSuite {
    const fullOptions: BenchmarkOptions = {
      ...this.baseOptions,
      ...options,
      name: options.name || `Benchmark ${this.benchmarks.length + 1}`
    } as BenchmarkOptions;

    this.benchmarks.push(new Benchmark(fn, fullOptions));
    return this;
  }

  /**
   * Run all benchmarks in the suite
   * @returns Results for all benchmarks
   */
  async run(): Promise<BenchmarkResult[]> {
    console.log(`Running benchmark suite: ${this.name}`);
    console.log(`Total benchmarks: ${this.benchmarks.length}`);

    let results: BenchmarkResult[] = [];

    if (this.parallel) {
      // Run benchmarks in parallel
      results = await Promise.all(this.benchmarks.map(benchmark => benchmark.run()));
    } else {
      // Run benchmarks sequentially
      for (const benchmark of this.benchmarks) {
        results.push(await benchmark.run());
      }
    }

    console.log(`Completed benchmark suite: ${this.name}`);
    return results;
  }

  /**
   * Compare the results of two benchmarks
   * @param benchmark1Name Name of first benchmark
   * @param benchmark2Name Name of second benchmark
   * @param results Results to compare
   * @returns Comparison as a string
   */
  compareResults(
    benchmark1Name: string,
    benchmark2Name: string,
    results: BenchmarkResult[]
  ): string {
    const result1 = results.find(r => r.name === benchmark1Name);
    const result2 = results.find(r => r.name === benchmark2Name);

    if (!result1 || !result2) {
      return 'Cannot compare: one or both benchmarks not found';
    }

    const timeRatio = result2.averageTime / result1.averageTime;
    const opsRatio = result1.opsPerSecond / result2.opsPerSecond;

    let output = `Comparison: ${benchmark1Name} vs ${benchmark2Name}\n`;
    output += `  Time ratio: ${timeRatio.toFixed(2)}x`;
    output += ` (${result1.name} is ${timeRatio > 1 ? 'faster' : 'slower'})\n`;
    output += `  Ops/sec ratio: ${opsRatio.toFixed(2)}x`;
    output += ` (${result1.name} performs ${opsRatio > 1 ? 'more' : 'fewer'} operations per second)\n`;

    if (result1.memoryStats && result2.memoryStats) {
      const heapRatio = result2.memoryStats.diff.heapUsed / result1.memoryStats.diff.heapUsed;
      output += `  Memory usage ratio: ${heapRatio.toFixed(2)}x`;
      output += ` (${result1.name} uses ${heapRatio > 1 ? 'less' : 'more'} memory)\n`;
    }

    return output;
  }

  /**
   * Save benchmark results to a file
   * @param results Results to save
   * @param filePath Path to save to (defaults to results directory)
   */
  saveResults(results: BenchmarkResult[], filePath?: string): void {
    // Create default path if not provided
    if (!filePath) {
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const defaultPath = path.join(process.cwd(), 'benchmark-results');

      // Ensure directory exists
      if (!fs.existsSync(defaultPath)) {
        fs.mkdirSync(defaultPath, { recursive: true });
      }

      filePath = path.join(defaultPath, `${this.name}-${timestamp}.json`);
    }

    // Create result object with metadata
    const resultData = {
      suite: {
        name: this.name,
        description: this.description,
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      results
    };

    // Write to file
    fs.writeFileSync(filePath, JSON.stringify(resultData, null, 2));
    console.log(`Benchmark results saved to: ${filePath}`);
  }
}

/**
 * Performance trace decorator for methods
 * @param target Target object
 * @param propertyKey Method name
 * @param descriptor Method descriptor
 * @returns Modified descriptor
 */
export function trace(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
): PropertyDescriptor {
  const originalMethod = descriptor.value;

  descriptor.value = function (...args: any[]): any {
    const className = target.constructor.name;
    const methodName = propertyKey;
    const label = `${className}.${methodName}`;

    performance.mark(`${label}-start`);
    const result = originalMethod.apply(this, args);

    // Handle both synchronous and asynchronous methods
    if (result instanceof Promise) {
      return result.finally(() => {
        performance.mark(`${label}-end`);
        performance.measure(label, `${label}-start`, `${label}-end`);
      });
    }

    performance.mark(`${label}-end`);
    performance.measure(label, `${label}-start`, `${label}-end`);
    return result;
  };

  return descriptor;
}
