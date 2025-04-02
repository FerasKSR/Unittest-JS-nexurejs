/**
 * Nexure.js Consolidated Profiling Tool
 *
 * This script combines CPU profiling, memory profiling, and stream processing profiling
 * into a single unified tool for performance analysis and optimization.
 */

import { writeFileSync, createReadStream, createWriteStream, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { Transform, pipeline } from 'node:stream';
import { promisify } from 'node:util';
import { performance, PerformanceObserver } from 'node:perf_hooks';
import v8 from 'node:v8';
import os from 'node:os';

// Import data generators for test data
import {
  generateTextData,
  generateJsonData,
  generateCsvData,
  generateNestedObject
} from './data-generators.js';

// Import inspector dynamically
let inspector;
try {
  inspector = await import('inspector');
} catch (err) {
  console.error('Failed to import inspector module:', err);
}

// Promisify pipeline for easier use
const pipelineAsync = promisify(pipeline);

// Set up performance observer
const performanceObserver = new PerformanceObserver((items) => {
  const entries = items.getEntries();
  entries.forEach(entry => {
    console.log(`Performance: ${entry.name} - ${entry.duration.toFixed(2)}ms`);
  });
});
performanceObserver.observe({ entryTypes: ['measure'], buffered: true });

// Ensure output directories exist
const BASE_DIR = process.cwd();
const RESULTS_DIR = join(BASE_DIR, 'benchmarks', 'profiling-results');
const CPU_PROFILES_DIR = join(RESULTS_DIR, 'cpu-profiles');
const MEMORY_PROFILES_DIR = join(RESULTS_DIR, 'memory-profiles');

// Create necessary directories
[RESULTS_DIR, CPU_PROFILES_DIR, MEMORY_PROFILES_DIR].forEach(dir => {
  try {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  } catch (err) {
    console.error(`Failed to create directory ${dir}:`, err);
  }
});

// ========================
// CPU PROFILING
// ========================

/**
 * CPU Profiler class
 */
class CpuProfiler {
  constructor(options = {}) {
    this.sessionName = options.name || `cpu-profile-${Date.now()}`;
    this.outputPath = options.outputPath || CPU_PROFILES_DIR;
    this.session = null;
    this.active = false;
    this.memorySnapshots = [];
  }

  /**
   * Initialize the profiler
   */
  initialize() {
    if (!inspector) {
      throw new Error('Inspector module not available');
    }

    this.session = new inspector.Session();
    this.session.connect();
    return this;
  }

  /**
   * Start CPU profiling
   */
  start() {
    if (!this.session) {
      this.initialize();
    }

    console.log(`Starting CPU profiling session: ${this.sessionName}`);
    this.session.post('Profiler.enable');
    this.session.post('Profiler.start');
    this.active = true;

    // Take initial memory snapshot
    this.takeMemorySnapshot('start');

    return this;
  }

  /**
   * Take a memory snapshot during profiling
   */
  takeMemorySnapshot(label) {
    const snapshot = {
      label,
      timestamp: Date.now(),
      memory: process.memoryUsage(),
      heapStats: v8.getHeapStatistics()
    };

    this.memorySnapshots.push(snapshot);

    console.log(`Memory Snapshot (${label}): RSS=${(snapshot.memory.rss / 1024 / 1024).toFixed(2)}MB, Heap=${(snapshot.memory.heapUsed / 1024 / 1024).toFixed(2)}MB`);

    return snapshot;
  }

  /**
   * Stop CPU profiling and save results
   */
  async stop() {
    if (!this.active || !this.session) {
      throw new Error('No active profiling session');
    }

    // Take final memory snapshot
    this.takeMemorySnapshot('end');

    return new Promise((resolve) => {
      this.session.post('Profiler.stop', (err, response) => {
        this.active = false;
        console.log('CPU profiling completed');

        if (err) {
          console.error('Error stopping profiler:', err);
          this.session.disconnect();
          resolve(null);
          return;
        }

        const { profile } = response;

        // Save the profile to a file
        const profileFile = join(this.outputPath, `${this.sessionName}.cpuprofile`);
        writeFileSync(profileFile, JSON.stringify(profile));
        console.log(`CPU profile saved to: ${profileFile}`);

        // Save heap snapshots
        const heapFile = join(this.outputPath, `${this.sessionName}-heap.json`);
        writeFileSync(heapFile, JSON.stringify(this.memorySnapshots, null, 2));
        console.log(`Heap snapshots saved to: ${heapFile}`);

        this.session.disconnect();
        this.session = null;
        resolve({ profileFile, heapFile });
      });
    });
  }
}

// ========================
// MEMORY PROFILING
// ========================

/**
 * Memory Profiler class
 */
class MemoryProfiler {
  constructor(options = {}) {
    this.label = options.name || `memory-profile-${Date.now()}`;
    this.outputPath = options.outputPath || MEMORY_PROFILES_DIR;
    this.snapshots = [];
    this.heapStats = [];
    this.heapTrackingInterval = null;
    this.startTime = Date.now();
    this.active = false;
  }

  /**
   * Start memory profiling
   */
  start(trackingIntervalMs = 100) {
    console.log(`Starting memory profiling session: ${this.label}`);
    this.active = true;
    this.startTime = Date.now();
    this.takeSnapshot('start');

    // Start tracking heap statistics
    if (trackingIntervalMs > 0) {
      this.startHeapTracking(trackingIntervalMs);
    }

    return this;
  }

  /**
   * Take a memory snapshot
   */
  takeSnapshot(label) {
    const snapshot = {
      id: this.snapshots.length + 1,
      label,
      timestamp: Date.now(),
      elapsed: Date.now() - this.startTime,
      memory: process.memoryUsage(),
      heapStats: v8.getHeapStatistics()
    };

    this.snapshots.push(snapshot);
    console.log(`Snapshot ${snapshot.id}: ${label} - RSS: ${(snapshot.memory.rss / 1024 / 1024).toFixed(2)}MB, Heap: ${(snapshot.memory.heapUsed / 1024 / 1024).toFixed(2)}MB`);

    return snapshot;
  }

  /**
   * Start tracking heap statistics at regular intervals
   */
  startHeapTracking(intervalMs = 100) {
    if (this.heapTrackingInterval) {
      clearInterval(this.heapTrackingInterval);
    }

    this.heapTrackingInterval = setInterval(() => {
      this.heapStats.push({
        timestamp: Date.now(),
        elapsed: Date.now() - this.startTime,
        memory: process.memoryUsage()
      });
    }, intervalMs);

    console.log(`Started heap tracking at ${intervalMs}ms intervals`);
    return this;
  }

  /**
   * Stop tracking heap statistics
   */
  stopHeapTracking() {
    if (this.heapTrackingInterval) {
      clearInterval(this.heapTrackingInterval);
      this.heapTrackingInterval = null;
      console.log(`Stopped heap tracking, collected ${this.heapStats.length} samples`);
    }
    return this;
  }

  /**
   * Mark performance measurement start
   */
  markStart(label) {
    performance.mark(`${label}-start`);
    return this;
  }

  /**
   * Mark performance measurement end and record
   */
  markEnd(label) {
    performance.mark(`${label}-end`);
    performance.measure(label, `${label}-start`, `${label}-end`);
    return this;
  }

  /**
   * Stop profiling and save results
   */
  stop(additionalData = {}) {
    if (!this.active) {
      throw new Error('No active profiling session');
    }

    // Take final snapshot
    this.takeSnapshot('end');

    // Stop tracking
    this.stopHeapTracking();
    this.active = false;

    // Generate the output
    const result = {
      label: this.label,
      startTime: this.startTime,
      endTime: Date.now(),
      duration: Date.now() - this.startTime,
      snapshots: this.snapshots,
      heapStats: this.heapStats,
      additionalData
    };

    // Save to file
    const filename = `${this.label}-${this.startTime}.json`;
    const filePath = join(this.outputPath, filename);

    writeFileSync(filePath, JSON.stringify(result, null, 2));
    console.log(`Memory profile saved to: ${filePath}`);

    return filePath;
  }
}

// ========================
// TEST DATA GENERATION
// ========================

/**
 * Generate test files of varying sizes
 */
async function generateTestFiles() {
  const outputDir = join(process.cwd(), 'test-data');

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Generate small JSON file (1MB)
  console.log('Generating small JSON file...');
  const smallData = [];
  for (let i = 0; i < 5000; i++) {
    smallData.push({
      id: i,
      name: `Item ${i}`,
      value: Math.random(),
      data: randomBytes(20).toString('hex')
    });
  }
  writeFileSync(
    join(outputDir, 'small.json'),
    JSON.stringify(smallData)
  );

  // Generate medium JSON file (10MB)
  console.log('Generating medium JSON file...');
  const mediumData = [];
  for (let i = 0; i < 50000; i++) {
    mediumData.push({
      id: i,
      name: `Item ${i}`,
      description: `This is test item number ${i} with some description text`,
      created: new Date().toISOString(),
      values: Array.from({ length: 5 }, () => Math.random()),
      data: randomBytes(50).toString('hex')
    });
  }
  writeFileSync(
    join(outputDir, 'medium.json'),
    JSON.stringify(mediumData)
  );

  // Generate large binary file (100MB)
  console.log('Generating large binary file...');
  const largeFilePath = join(outputDir, 'large.bin');
  const largeFileStream = createWriteStream(largeFilePath);

  // Write in chunks to avoid excessive memory usage
  const chunkSize = 1024 * 1024; // 1MB chunks
  const totalSize = 100 * 1024 * 1024; // 100MB total
  const totalChunks = totalSize / chunkSize;

  for (let i = 0; i < totalChunks; i++) {
    const chunk = randomBytes(chunkSize);
    largeFileStream.write(chunk);
  }

  largeFileStream.end();
  console.log('Test files generated successfully');
}

// ========================
// MOCK HTTP OBJECTS
// ========================

/**
 * Create a mock request stream with content
 */
function createMockRequest(content, options = {}) {
  // Create a request-like stream
  const baseReq = new Transform({
    transform(chunk, encoding, callback) {
      this.push(chunk);
      callback();
    }
  });

  // Add HTTP request properties
  baseReq.headers = {
    'content-type': options.contentType || 'application/json',
    'content-length': typeof content === 'string' ?
      content.length.toString() :
      (options.contentLength || '0')
  };
  baseReq.method = options.method || 'POST';
  baseReq.url = options.url || '/test';
  baseReq.httpVersion = '1.1';
  baseReq.httpVersionMajor = 1;
  baseReq.httpVersionMinor = 1;
  baseReq.socket = {
    remoteAddress: '127.0.0.1',
    remotePort: 12345
  };
  baseReq.aborted = false;
  baseReq.complete = false;
  baseReq.body = null;

  // Add the content to the stream
  setTimeout(() => {
    if (typeof content === 'string') {
      baseReq.push(content);
    } else if (Buffer.isBuffer(content)) {
      baseReq.push(content);
    } else if (typeof content === 'object') {
      baseReq.push(JSON.stringify(content));
    }
    baseReq.push(null); // End the stream
  }, 0);

  return baseReq;
}

/**
 * Create a mock response object
 */
function createMockResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    chunks: [],

    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },

    getHeader(name) {
      return this.headers[name.toLowerCase()];
    },

    status(code) {
      this.statusCode = code;
      return this;
    },

    end(data) {
      if (data) {
        if (typeof data === 'string') {
          this.chunks.push(Buffer.from(data));
        } else if (Buffer.isBuffer(data)) {
          this.chunks.push(data);
        } else {
          this.chunks.push(Buffer.from(JSON.stringify(data)));
        }
        this.body = data;
      }
    },

    json(data) {
      this.body = data;
      this.headers['content-type'] = 'application/json';
    },

    send(data) {
      this.body = data;
    },

    write(chunk) {
      if (chunk) {
        if (typeof chunk === 'string') {
          this.chunks.push(Buffer.from(chunk));
        } else if (Buffer.isBuffer(chunk)) {
          this.chunks.push(chunk);
        } else {
          this.chunks.push(Buffer.from(JSON.stringify(chunk)));
        }
      }
      return true;
    }
  };
}

// ========================
// TEST SCENARIOS
// ========================

/**
 * Test case for processing small JSON in memory
 */
async function testSmallJsonInMemory() {
  console.log('\n=== Running Small JSON In-Memory Test ===');

  // Import middleware
  const { createJsonTransformMiddleware } = await import('../src/middleware/stream-transform.js');
  const { createBodyParserMiddleware } = await import('../src/http/body-parser.js');

  // Create test data
  const testData = generateJsonData(100);
  const jsonString = JSON.stringify(testData);

  // Create memory profiler
  const memoryProfiler = new MemoryProfiler({
    name: 'small-json-in-memory'
  });
  memoryProfiler.start(200);

  // Create mock request and response
  const req = createMockRequest(jsonString, {
    contentType: 'application/json',
    contentLength: jsonString.length
  });
  const res = createMockResponse();

  // Create body parser middleware
  const bodyParser = createBodyParserMiddleware();

  // Process the request
  memoryProfiler.markStart('bodyParser');
  await bodyParser(req, res, () => {});
  memoryProfiler.markEnd('bodyParser');

  // Verify result
  if (req.body) {
    console.log(`Processed JSON object with ${Object.keys(req.body).length} items`);
  } else {
    console.warn('No body parsed');
  }

  // Stop profiling
  memoryProfiler.stop({
    dataSize: jsonString.length,
    itemCount: testData.length
  });
}

/**
 * Test case for processing large JSON with streaming
 */
async function testLargeJsonStreaming() {
  console.log('\n=== Running Large JSON Streaming Test ===');

  // Import middleware
  const { createJsonTransformMiddleware, StreamProcessor } = await import('../src/middleware/stream-transform.js');

  // Create test data
  const testData = generateJsonData(5000);
  const jsonString = JSON.stringify(testData);

  // Start CPU profiling
  const cpuProfiler = new CpuProfiler({
    name: 'large-json-streaming'
  });
  cpuProfiler.start();

  // Create mock request and response
  const req = createMockRequest(jsonString, {
    contentType: 'application/json',
    contentLength: jsonString.length
  });
  const res = createMockResponse();

  // Create stream processor
  const jsonTransformer = createJsonTransformMiddleware({
    streamArrayItems: true
  });

  // Process the stream
  let itemCount = 0;
  const stream = new Transform({
    objectMode: true,
    transform(chunk, encoding, callback) {
      itemCount++;
      this.push(chunk);
      callback();
    }
  });

  try {
    // Take memory snapshot before processing
    cpuProfiler.takeMemorySnapshot('before-processing');

    // Create the processing pipeline
    await pipelineAsync(
      req,
      jsonTransformer,
      stream
    );

    // Take memory snapshot after processing
    cpuProfiler.takeMemorySnapshot('after-processing');

    console.log(`Processed ${itemCount} items from JSON stream`);
  } catch (err) {
    console.error('Error processing stream:', err);
  }

  // Stop CPU profiling
  await cpuProfiler.stop();
}

/**
 * Run all profiling tests
 */
async function runAllTests() {
  console.log('=== Nexure.js Profiling Suite ===');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Node.js version: ${process.version}`);
  console.log(`OS: ${os.type()} ${os.release()} (${os.arch()})`);
  console.log(`CPU: ${os.cpus()[0].model} (${os.cpus().length} cores)`);
  console.log(`Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB`);
  console.log('======================================\n');

  try {
    // Generate test data if needed
    await generateTestFiles();

    // Run individual tests
    await testSmallJsonInMemory();
    await testLargeJsonStreaming();

    // Additional tests can be added here

    console.log('\n=== Profiling Completed Successfully ===');
  } catch (err) {
    console.error('Error running profiling tests:', err);
  }
}

// ========================
// EXPORTS
// ========================

export {
  CpuProfiler,
  MemoryProfiler,
  generateTestFiles,
  createMockRequest,
  createMockResponse,
  testSmallJsonInMemory,
  testLargeJsonStreaming,
  runAllTests
};

// Run all tests if this file is executed directly
if (process.argv[1] === import.meta.url) {
  runAllTests();
}
