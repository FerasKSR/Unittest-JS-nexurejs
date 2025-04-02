/**
 * Performance test for the Nexure HTTP server
 */

'use strict';

import { performance, PerformanceObserver } from 'perf_hooks';
import http from 'http';

// Configuration
const TEST_DURATION_MS = 5000;
const CONCURRENT_CONNECTIONS = 100;
const SERVER_URL = 'http://localhost';
const SERVER_PORT = 3000;

// Set up performance observer
const perfObserver = new PerformanceObserver((items) => {
  const entries = items.getEntries();

  // Calculate statistics
  const times = entries.map((entry) => entry.duration);
  const total = times.reduce((acc, time) => acc + time, 0);
  const average = total / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);

  // Sort times for percentile calculations
  times.sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length * 0.5)];
  const p90 = times[Math.floor(times.length * 0.9)];
  const p99 = times[Math.floor(times.length * 0.99)];

  // Log results
  console.log(`\nResults for ${entries.length} requests:`);
  console.log(`Average response time: ${average.toFixed(2)}ms`);
  console.log(`Min response time: ${min.toFixed(2)}ms`);
  console.log(`Max response time: ${max.toFixed(2)}ms`);
  console.log(`Median (P50): ${p50.toFixed(2)}ms`);
  console.log(`P90: ${p90.toFixed(2)}ms`);
  console.log(`P99: ${p99.toFixed(2)}ms`);
  console.log(`Requests per second: ${(entries.length / (TEST_DURATION_MS / 1000)).toFixed(2)}`);
});

// Start observing performance measurements
perfObserver.observe({ entryTypes: ['measure'] });

// Main function
async function runPerformanceTest() {
  console.log(`Starting performance test with ${CONCURRENT_CONNECTIONS} concurrent connections`);
  console.log(`Test duration: ${TEST_DURATION_MS / 1000} seconds`);
  console.log(`Server: ${SERVER_URL}:${SERVER_PORT}`);
  console.log('---------------------------------------------');

  let requestCount = 0;
  let errorCount = 0;

  // Function to make a single request
  function makeRequest(id) {
    const startMark = `request-start-${id}`;
    const endMark = `request-end-${id}`;

    performance.mark(startMark);

    return new Promise((resolve) => {
      const req = http.get(`${SERVER_URL}:${SERVER_PORT}/`, (res) => {
        res.on('data', () => {});
        res.on('end', () => {
          performance.mark(endMark);
          performance.measure(`request-${id}`, startMark, endMark);
          requestCount++;
          resolve();
        });
      });

      req.on('error', (err) => {
        errorCount++;
        resolve();
      });

      req.end();
    });
  }

  // Create a pool of connections
  const startTime = Date.now();
  const endTime = startTime + TEST_DURATION_MS;
  let requestId = 0;

  // Function to keep connections busy
  async function keepConnectionBusy(connectionId) {
    while (Date.now() < endTime) {
      await makeRequest(requestId++);
    }
  }

  // Start concurrent connections
  const connections = Array.from({ length: CONCURRENT_CONNECTIONS }, (_, i) => keepConnectionBusy(i));

  // Wait for all connections to finish
  await Promise.all(connections);

  // Log final results
  console.log('---------------------------------------------');
  console.log(`Test completed. ${requestCount} requests completed, ${errorCount} errors.`);

  // Disconnect the observer when done
  perfObserver.disconnect();
}

// Check if this script is being run directly
if (process.argv[1] === import.meta.url) {
  runPerformanceTest().catch(console.error);
}

export default runPerformanceTest;
