import 'reflect-metadata';
import {
  Nexure,
  Controller,
  Get,
  Post,
  Injectable,
  PerformanceMonitor,
  WorkerPool,
  ClusterManager,
  CacheManager,
  createCacheMiddleware,
  initNativeBindings,
  fastJsonParse,
  fastJsonStringify
} from '../../src/index.js';
import { join } from 'node:path';
import cluster from 'node:cluster';

// Initialize native bindings
initNativeBindings();

// Create a performance monitor
const performanceMonitor = new PerformanceMonitor({
  memoryMonitoring: true,
  eventLoopMonitoring: true,
  gcMonitoring: true
});

// Start performance monitoring
performanceMonitor.start();

// Create a cache manager
const cacheManager = new CacheManager();

// Create a service
@Injectable()
class ComputeService {
  // Simulate a CPU-intensive task
  computeFibonacci(n: number): number {
    if (n <= 1) return n;
    return this.computeFibonacci(n - 1) + this.computeFibonacci(n - 2);
  }

  // Simulate a task that can benefit from caching
  getCachedData(key: string): Promise<any> {
    return cacheManager.get(key);
  }

  // Store data in cache
  setCachedData(key: string, value: any, ttl: number = 60000): Promise<void> {
    return cacheManager.set(key, value, { ttl });
  }
}

// Create a controller
@Controller('/performance')
class PerformanceController {
  constructor(private computeService: ComputeService) {}

  @Get('/fibonacci/:n')
  computeFibonacci({ params }: { params: any }) {
    // Mark the start of the computation
    performanceMonitor.mark('fibonacci-start');

    // Compute fibonacci
    const n = parseInt(params.n, 10) || 10;
    const result = this.computeService.computeFibonacci(n);

    // Measure the computation time
    const duration = performanceMonitor.measure('fibonacci', 'fibonacci-start');

    return {
      result,
      duration: `${duration.toFixed(2)}ms`
    };
  }

  @Get('/cached/:key')
  async getCachedData({ params }: { params: any }) {
    const key = params.key || 'default';

    // Try to get from cache
    let data = await this.computeService.getCachedData(key);
    let fromCache = true;

    if (!data) {
      // Generate data if not in cache
      fromCache = false;
      data = {
        key,
        value: Math.random(),
        timestamp: new Date().toISOString()
      };

      // Store in cache for 1 minute
      await this.computeService.setCachedData(key, data, 60000);
    }

    return {
      data,
      fromCache
    };
  }

  @Post('/cached/:key')
  async setCachedData({ params, body }: { params: any, body: any }) {
    const key = params.key || 'default';

    // Store in cache
    await this.computeService.setCachedData(key, body);

    return {
      success: true,
      message: `Data stored in cache with key: ${key}`
    };
  }

  @Get('/json')
  testJsonPerformance() {
    // Create a large object
    const data = {
      items: Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        value: Math.random(),
        nested: {
          a: 1,
          b: 2,
          c: [1, 2, 3]
        }
      }))
    };

    // Mark the start of JSON stringify
    performanceMonitor.mark('json-stringify-start');

    // Stringify using fast JSON
    const jsonString = fastJsonStringify(data);

    // Measure stringify time
    const stringifyTime = performanceMonitor.measure('json-stringify', 'json-stringify-start');

    // Mark the start of JSON parse
    performanceMonitor.mark('json-parse-start');

    // Parse using fast JSON
    const parsedData = fastJsonParse(jsonString);

    // Measure parse time
    const parseTime = performanceMonitor.measure('json-parse', 'json-parse-start');

    return {
      stringifyTime: `${stringifyTime.toFixed(2)}ms`,
      parseTime: `${parseTime.toFixed(2)}ms`,
      dataSize: jsonString.length
    };
  }

  @Get('/metrics')
  getMetrics() {
    return performanceMonitor.createReport();
  }
}

// Check if this is the primary process
if (cluster.isPrimary) {
  // Create a cluster manager
  const clusterManager = new ClusterManager({
    numWorkers: 2,
    restartOnExit: true
  });

  // Start the cluster
  clusterManager.start();

  // Log when workers are forked
  clusterManager.on('fork', (worker) => {
    console.log(`Worker ${worker.id} forked`);
  });

  // Log when workers exit
  clusterManager.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.id} exited with code ${code} and signal ${signal}`);
  });
} else {
  // This is a worker process

  // Create a worker pool for CPU-intensive tasks
  const workerPool = new WorkerPool({
    workerScript: join(process.cwd(), 'examples', 'performance', 'worker.js'),
    numWorkers: 2
  });

  // Create the application
  const app = new Nexure({
    logging: true,
    prettyJson: true
  });

  // Add cache middleware
  app.use(createCacheMiddleware(cacheManager, {
    ttl: 60000,
    condition: (req) => req.method === 'GET'
  }));

  // Register the controller
  app.register(PerformanceController);

  // Start the server
  app.listen(3000, () => {
    console.log('Performance example app is running at http://localhost:3000/');
    console.log('Try the following routes:');
    console.log('  GET  /performance/fibonacci/:n');
    console.log('  GET  /performance/cached/:key');
    console.log('  POST /performance/cached/:key');
    console.log('  GET  /performance/json');
    console.log('  GET  /performance/metrics');
  });
}
