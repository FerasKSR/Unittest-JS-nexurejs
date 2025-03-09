/**
 * Performance Benchmarking Tool
 *
 * A simplified version of the benchmarking utility for measuring code performance.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { performance } from 'node:perf_hooks';

/**
 * Represents a single benchmark
 */
export class Benchmark {
  /**
   * Create a new benchmark
   * @param {Function} fn Function to benchmark
   * @param {Object} options Benchmark options
   */
  constructor(fn, options) {
    this.fn = fn;
    this.name = options.name;
    this.description = options.description;
    this.iterations = options.iterations || 1000;
    this.warmup = options.warmup || 10;
  }

  /**
   * Run the benchmark
   * @returns {Object} Benchmark results
   */
  async run() {
    console.log(`Running benchmark: ${this.name}`);

    // Warmup phase
    console.log(`Warming up for ${this.warmup} iterations...`);
    for (let i = 0; i < this.warmup; i++) {
      await this.fn();
    }

    // Measure phase
    console.log(`Running ${this.iterations} iterations...`);
    const times = [];
    const startTime = performance.now();

    for (let i = 0; i < this.iterations; i++) {
      const iterStart = performance.now();
      await this.fn();
      times.push(performance.now() - iterStart);
    }

    const totalTime = performance.now() - startTime;

    // Calculate statistics
    times.sort((a, b) => a - b);
    const avgTime = totalTime / this.iterations;
    const opsPerSecond = Math.round(1000 / avgTime);

    // Calculate standard deviation
    const sumDiffSquared = times.reduce((sum, time) => {
      const diff = time - avgTime;
      return sum + (diff * diff);
    }, 0);
    const stdDev = Math.sqrt(sumDiffSquared / this.iterations);

    // Calculate percentiles
    const p50 = this.percentile(times, 0.5);
    const p90 = this.percentile(times, 0.9);
    const p95 = this.percentile(times, 0.95);
    const p99 = this.percentile(times, 0.99);

    // Create result object
    const result = {
      name: this.name,
      description: this.description,
      iterations: this.iterations,
      totalTime,
      averageTime: avgTime,
      opsPerSecond,
      stdDev,
      percentiles: {
        p50,
        p90,
        p95,
        p99
      },
      timestamp: new Date().toISOString()
    };

    console.log(`Completed benchmark: ${this.name}`);
    console.log(`  Average time: ${avgTime.toFixed(4)}ms`);
    console.log(`  Operations/second: ${opsPerSecond.toLocaleString()}`);

    return result;
  }

  /**
   * Calculate a percentile value from an array of numbers
   * @param {Array<number>} values Sorted array of values
   * @param {number} percentile Percentile to calculate (0-1)
   * @returns {number} The percentile value
   */
  percentile(values, percentile) {
    if (values.length === 0) return 0;

    const index = Math.max(0, Math.min(
      Math.floor(percentile * values.length),
      values.length - 1
    ));

    return values[index];
  }
}

/**
 * A suite of benchmarks to run together
 */
export class BenchmarkSuite {
  /**
   * Create a new benchmark suite
   * @param {Object} options Suite options
   */
  constructor(options) {
    this.name = options.name;
    this.description = options.description;
    this.parallel = options.parallel || false;
    this.baseOptions = options.baseOptions || {};
    this.benchmarks = [];
  }

  /**
   * Add a benchmark to the suite
   * @param {Function} fn Function to benchmark
   * @param {Object} options Benchmark options
   * @returns {BenchmarkSuite} This suite for chaining
   */
  add(fn, options) {
    const fullOptions = {
      ...this.baseOptions,
      ...options,
      name: options.name || `Benchmark ${this.benchmarks.length + 1}`
    };

    this.benchmarks.push(new Benchmark(fn, fullOptions));
    return this;
  }

  /**
   * Run all benchmarks in the suite
   * @returns {Array<Object>} Results for all benchmarks
   */
  async run() {
    console.log(`Running benchmark suite: ${this.name}`);
    console.log(`Total benchmarks: ${this.benchmarks.length}`);

    let results = [];

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
   * @param {string} benchmark1Name Name of first benchmark
   * @param {string} benchmark2Name Name of second benchmark
   * @param {Array<Object>} results Results to compare
   * @returns {string} Comparison as a string
   */
  compareResults(benchmark1Name, benchmark2Name, results) {
    const result1 = results.find(r => r.name === benchmark1Name);
    const result2 = results.find(r => r.name === benchmark2Name);

    if (!result1 || !result2) {
      return `Cannot compare: one or both benchmarks not found`;
    }

    const timeRatio = result2.averageTime / result1.averageTime;
    const opsRatio = result1.opsPerSecond / result2.opsPerSecond;

    let output = `Comparison: ${benchmark1Name} vs ${benchmark2Name}\n`;
    output += `  Time ratio: ${timeRatio.toFixed(2)}x`;
    output += ` (${result1.name} is ${timeRatio > 1 ? 'faster' : 'slower'})\n`;
    output += `  Ops/sec ratio: ${opsRatio.toFixed(2)}x`;
    output += ` (${result1.name} performs ${opsRatio > 1 ? 'more' : 'fewer'} operations per second)\n`;

    return output;
  }

  /**
   * Save benchmark results to a file
   * @param {Array<Object>} results Results to save
   * @param {string} filePath Path to save to (defaults to results directory)
   */
  saveResults(results, filePath) {
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
