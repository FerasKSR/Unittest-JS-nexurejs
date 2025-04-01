#!/usr/bin/env node
/**
 * Profiling Test Runner
 *
 * This script allows running specific profiling tests from the command line.
 * Usage: node run.js [test-name]
 */

import {
  CpuProfiler,
  MemoryProfiler,
  testSmallJsonInMemory,
  testLargeJsonStreaming,
  runAllTests
} from './profiler.js';

// Get the test name from command line arguments
const testName = process.argv[2]?.toLowerCase();

// Display help if no test name provided
if (!testName || testName === 'help' || testName === '--help' || testName === '-h') {
  console.log(`
Nexure.js Profiling Test Runner
-------------------------------
Usage: node run.js [test-name]

Available tests:
  all                  - Run all profiling tests
  smallJsonInMemory    - Test small JSON processing in memory
  largeJsonStreaming   - Test large JSON processing with streaming

Examples:
  node run.js all
  node run.js smallJsonInMemory
  `);
  process.exit(0);
}

// Run the specified test
async function main() {
  console.log(`Running profiling test: ${testName}`);

  try {
    if (testName === 'all') {
      await runAllTests();
    } else if (testName === 'smalljsoninmemory') {
      await testSmallJsonInMemory();
    } else if (testName === 'largejsonstreaming') {
      await testLargeJsonStreaming();
    } else {
      console.error(`Unknown test: ${testName}`);
      process.exit(1);
    }

    console.log(`Test "${testName}" completed successfully`);
  } catch (err) {
    console.error(`Test "${testName}" failed:`, err);
    process.exit(1);
  }
}

// Run the main function
main().catch(err => {
  console.error('Error running profiling test:', err);
  process.exit(1);
});
