/**
 * NexureJS Native Modules Example
 *
 * This example demonstrates how to use the native modules in a NexureJS application.
 * It shows the performance benefits of using native modules for HTTP parsing, routing,
 * and JSON processing.
 */

import { NexureApp } from '../../src/index';
import { Controller, Get, Post, Body } from '../../src/decorators';
import { HttpParser, RadixRouter, JsonProcessor, hasNativeSupport, configureNativeModules, getNativeModuleStatus, resetAllPerformanceMetrics, getAllPerformanceMetrics } from '../../src/native/index';
import { performance } from 'perf_hooks';

// Configure native modules
configureNativeModules({
  enabled: true,
  verbose: true,
  httpParser: true,
  radixRouter: true,
  jsonProcessor: true,
  maxCacheSize: 1000
});

// Check if native modules are available
const status = getNativeModuleStatus();
console.log('Native Module Status:');
console.log(JSON.stringify(status, null, 2));

// Create a simple HTTP request buffer for testing
const sampleHttpRequest = Buffer.from(
  'GET /api/users?page=1&limit=20 HTTP/1.1\r\n' +
  'Host: example.com\r\n' +
  'User-Agent: Mozilla/5.0\r\n' +
  'Accept: application/json\r\n' +
  'Content-Type: application/json\r\n' +
  'Content-Length: 27\r\n' +
  '\r\n' +
  '{"username":"john","age":30}'
);

// Create a sample JSON object for testing
const sampleJsonObject = {
  id: 123,
  name: "Product",
  price: 99.99,
  inStock: true,
  tags: ["electronics", "gadget"],
  manufacturer: {
    id: 45,
    name: "ACME Corp",
    location: "New York"
  }
};

// Controller that demonstrates native module usage
@Controller('/native')
class NativeModulesController {
  private httpParser = new HttpParser();
  private jsonProcessor = new JsonProcessor();
  private radixRouter = new RadixRouter();

  constructor() {
    // Add some routes to the router
    this.radixRouter.add('GET', '/users', { handler: 'getAllUsers' });
    this.radixRouter.add('GET', '/users/:id', { handler: 'getUserById' });
    this.radixRouter.add('POST', '/users', { handler: 'createUser' });
  }

  @Get()
  getNativeStatus() {
    return {
      nativeSupport: hasNativeSupport,
      message: hasNativeSupport
        ? 'Native modules are available and enabled!'
        : 'Native modules are not available. Using JavaScript fallbacks.'
    };
  }

  @Get('/http-parser')
  testHttpParser() {
    const start = performance.now();

    // Parse the HTTP request 1000 times
    for (let i = 0; i < 1000; i++) {
      this.httpParser.parse(sampleHttpRequest);
    }

    const end = performance.now();
    const duration = end - start;

    // Parse one more time to return the result
    const result = this.httpParser.parse(sampleHttpRequest);

    return {
      nativeSupport: hasNativeSupport,
      parseTime: `${duration.toFixed(2)}ms for 1000 iterations`,
      opsPerSecond: Math.floor(1000 / (duration / 1000)),
      result: {
        method: result.method,
        url: result.url,
        httpVersion: result.httpVersion,
        headers: result.headers,
        body: result.body ? result.body.toString() : null
      }
    };
  }

  @Get('/json-processor')
  testJsonProcessor() {
    const jsonString = JSON.stringify(sampleJsonObject);

    const start = performance.now();

    // Parse and stringify the JSON 1000 times
    for (let i = 0; i < 1000; i++) {
      const parsed = this.jsonProcessor.parse(jsonString);
      this.jsonProcessor.stringify(parsed);
    }

    const end = performance.now();
    const duration = end - start;

    return {
      nativeSupport: hasNativeSupport,
      processTime: `${duration.toFixed(2)}ms for 1000 iterations`,
      opsPerSecond: Math.floor(1000 / (duration / 1000)),
      originalSize: jsonString.length,
      parsed: this.jsonProcessor.parse(jsonString)
    };
  }

  @Get('/router')
  testRouter() {
    const urls = [
      '/users',
      '/users/123',
      '/users/456',
      '/unknown/path'
    ];

    const start = performance.now();

    // Find routes 1000 times
    for (let i = 0; i < 1000; i++) {
      for (const url of urls) {
        this.radixRouter.find('GET', url);
      }
    }

    const end = performance.now();
    const duration = end - start;

    // Get the results for each URL
    const results = urls.map(url => {
      const match = this.radixRouter.find('GET', url);
      return {
        url,
        found: match.found,
        handler: match.found ? match.handler : null,
        params: match.params
      };
    });

    return {
      nativeSupport: hasNativeSupport,
      routeTime: `${duration.toFixed(2)}ms for ${urls.length * 1000} lookups`,
      opsPerSecond: Math.floor((urls.length * 1000) / (duration / 1000)),
      results
    };
  }

  @Post('/benchmark')
  runBenchmark(@Body() options: any) {
    const iterations = options?.iterations || 10000;

    // HTTP Parser benchmark
    const httpStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      this.httpParser.parse(sampleHttpRequest);
    }
    const httpEnd = performance.now();
    const httpDuration = httpEnd - httpStart;

    // JSON Processor benchmark
    const jsonString = JSON.stringify(sampleJsonObject);
    const jsonStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const parsed = this.jsonProcessor.parse(jsonString);
      this.jsonProcessor.stringify(parsed);
    }
    const jsonEnd = performance.now();
    const jsonDuration = jsonEnd - jsonStart;

    // Router benchmark
    const urls = ['/users', '/users/123', '/unknown/path'];
    const routerStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      for (const url of urls) {
        this.radixRouter.find('GET', url);
      }
    }
    const routerEnd = performance.now();
    const routerDuration = routerEnd - routerStart;

    return {
      nativeSupport: hasNativeSupport,
      iterations,
      results: {
        httpParser: {
          time: `${httpDuration.toFixed(2)}ms`,
          opsPerSecond: Math.floor(iterations / (httpDuration / 1000))
        },
        jsonProcessor: {
          time: `${jsonDuration.toFixed(2)}ms`,
          opsPerSecond: Math.floor(iterations / (jsonDuration / 1000))
        },
        router: {
          time: `${routerDuration.toFixed(2)}ms`,
          opsPerSecond: Math.floor((iterations * urls.length) / (routerDuration / 1000))
        }
      }
    };
  }
}

// Create and start the application
const app = new NexureApp();
app.useController(NativeModulesController);

const port = 3000;
app.listen(port, () => {
  console.log(`NexureJS Native Modules Example running at http://localhost:${port}`);
  console.log(`Native modules support: ${hasNativeSupport ? 'Enabled' : 'Disabled (using JavaScript fallbacks)'}`);
  console.log('\nAvailable endpoints:');
  console.log(`- GET  http://localhost:${port}/native - Check native module status`);
  console.log(`- GET  http://localhost:${port}/native/http-parser - Test HTTP parser performance`);
  console.log(`- GET  http://localhost:${port}/native/json-processor - Test JSON processor performance`);
  console.log(`- GET  http://localhost:${port}/native/router - Test router performance`);
  console.log(`- POST http://localhost:${port}/native/benchmark - Run comprehensive benchmark`);
});
