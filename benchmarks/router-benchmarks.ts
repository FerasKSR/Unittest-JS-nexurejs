/**
 * Router Benchmarks
 *
 * Compares the performance of native C++ router implementation
 * against the JavaScript implementation.
 */

import { runBenchmark, compareResults } from './index.js';
import { RadixRouter as NativeRadixRouter } from '../src/native/index.js';
import { RadixRouter as JsRadixRouter } from '../src/routing/radix-router.js';
import { HttpMethod } from '../src/http/http-method.js';
import { IncomingMessage, ServerResponse } from 'node:http';

// Create a dummy route handler function
const dummyHandler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  // Just do something with the request but don't return a value
  const success = true;
};

// Sample routes for testing
const sampleRoutes = [
  { path: '/api/users', handler: dummyHandler },
  { path: '/api/users/:id', handler: dummyHandler },
  { path: '/api/posts', handler: dummyHandler },
  { path: '/api/posts/:id', handler: dummyHandler },
  { path: '/api/posts/:id/comments', handler: dummyHandler },
  { path: '/api/comments', handler: dummyHandler },
  { path: '/api/comments/:id', handler: dummyHandler },
  { path: '/api/auth/login', handler: dummyHandler },
  { path: '/api/auth/register', handler: dummyHandler },
  { path: '/api/auth/logout', handler: dummyHandler },
  { path: '/api/profile', handler: dummyHandler },
  { path: '/api/settings', handler: dummyHandler },
  { path: '/api/settings/:section', handler: dummyHandler },
  { path: '/api/notifications', handler: dummyHandler },
  { path: '/api/search', handler: dummyHandler }
];

// Sample paths to lookup
const sampleLookups = [
  '/api/users',
  '/api/users/123',
  '/api/posts',
  '/api/posts/456',
  '/api/posts/456/comments',
  '/api/comments',
  '/api/comments/789',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/profile',
  '/api/settings',
  '/api/settings/account',
  '/api/notifications',
  '/api/search'
];

/**
 * Benchmark router route matching
 */
function benchmarkRouteMatching(): void {
  console.log('\n=== Router Route Matching ===');

  try {
    // Create JS router
    const jsRouter = new JsRadixRouter();

    // Add routes
    for (const route of sampleRoutes) {
      jsRouter.addRoute(HttpMethod._GET, route.path, route.handler);
    }

    // Benchmark JavaScript implementation
    const jsResult = runBenchmark('JS Router', 'router', () => {
      for (const path of sampleLookups) {
        // Use lookup method which is the actual method in the JS implementation
        (jsRouter as any).lookup(HttpMethod._GET, path);
      }
    }, 1000);

    console.log(`Router Matching: ${jsResult.opsPerSecond.toLocaleString()} ops/sec`);
  } catch (error) {
    console.error('Error in router benchmark:', error);
  }
}

/**
 * Benchmark router route addition
 */
function benchmarkRouteAddition(): void {
  console.log('\n=== Router Route Addition ===');

  try {
    // Benchmark native implementation
    const nativeResult = runBenchmark('Native Router Addition', 'router', () => {
      const router = new NativeRadixRouter();
      for (const route of sampleRoutes) {
        (router as any).add('GET', route.path, route.handler);
      }
    }, 1000);

    // Benchmark JavaScript implementation
    const jsResult = runBenchmark('JS Router Addition', 'router', () => {
      const router = new JsRadixRouter();
      for (const route of sampleRoutes) {
        router.addRoute(HttpMethod._GET, route.path, route.handler);
      }
    }, 1000);

    // Compare results
    compareResults(nativeResult, jsResult);
  } catch (error) {
    console.error('Error in router addition benchmark:', error);
  }
}

/**
 * Run all router benchmarks
 */
export async function runRouterBenchmarks(): Promise<void> {
  benchmarkRouteMatching();
  benchmarkRouteAddition();
}
