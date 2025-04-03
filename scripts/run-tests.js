#!/usr/bin/env node

/**
 * Test Runner Script for NexureJS
 *
 * This script runs all the tests and generates a report.
 *
 * Usage:
 *   node scripts/run-tests.js [options]
 *
 * Options:
 *   --unit            Run only unit tests
 *   --integration     Run only integration tests
 *   --compatibility   Run only compatibility tests
 *   --performance     Run performance tests
 *   --all             Run all tests (default)
 *   --watch           Run tests in watch mode
 *   --coverage        Generate coverage report
 */

'use strict';

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const cliArgs = process.argv.slice(2);
const options = {
  unit: cliArgs.includes('--unit'),
  integration: cliArgs.includes('--integration'),
  compatibility: cliArgs.includes('--compatibility'),
  performance: cliArgs.includes('--performance'),
  watch: cliArgs.includes('--watch'),
  coverage: cliArgs.includes('--coverage'),
};

// If no specific test type is specified, run all tests except performance tests
if (!options.unit && !options.integration && !options.compatibility && !options.performance) {
  options.unit = options.integration = options.compatibility = true;
}

// If --all is specified, run all tests including performance tests
if (cliArgs.includes('--all')) {
  options.unit = options.integration = options.compatibility = options.performance = true;
}

console.log('NexureJS Test Runner');
console.log('===================');
console.log('Running tests with the following options:');
console.log(`- Unit tests: ${options.unit ? 'Yes' : 'No'}`);
console.log(`- Integration tests: ${options.integration ? 'Yes' : 'No'}`);
console.log(`- Compatibility tests: ${options.compatibility ? 'Yes' : 'No'}`);
console.log(`- Performance tests: ${options.performance ? 'Yes' : 'No'}`);
console.log(`- Watch mode: ${options.watch ? 'Yes' : 'No'}`);
console.log(`- Coverage: ${options.coverage ? 'Yes' : 'No'}`);
console.log();

// Run function to execute a command
async function runCommand(command, args, cwd = resolve(__dirname, '..')) {
  return new Promise((resolve, reject) => {
    console.log(`Running command: ${command} ${args.join(' ')}`);
    console.log();

    const proc = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      cwd,
      env: {
        ...process.env,
        NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --experimental-vm-modules`.trim()
      }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    // Handle interruption
    process.on('SIGINT', () => {
      proc.kill('SIGINT');
    });
  });
}

// Main function to run tests
async function runTests() {
  try {
    // Run Jest tests if any of unit, integration, or compatibility tests are enabled
    if (options.unit || options.integration || options.compatibility) {
      // Build the Jest command
      let command = 'node';
      let jestArgs = ['--experimental-vm-modules', 'node_modules/jest/bin/jest.js'];

      // Add test match patterns based on options
      const testMatches = [];
      if (options.unit) testMatches.push('**/test/unit/**/*.test.ts');
      if (options.integration) testMatches.push('**/test/integration/**/*.test.ts');
      if (options.compatibility) testMatches.push('**/test/compatibility/**/*.test.ts');

      if (testMatches.length > 0) {
        jestArgs.push(`--testMatch="${testMatches.join('|')}"`);
      }

      // Add watch mode if specified
      if (options.watch) {
        jestArgs.push('--watch');
      }

      // Add coverage if specified
      if (options.coverage) {
        jestArgs.push('--coverage');

        // Skip enforcing coverage thresholds
        jestArgs.push('--coverageThreshold={}');
      }

      await runCommand(command, jestArgs);
    }

    // Run performance tests if enabled
    if (options.performance) {
      console.log('\nRunning performance tests...\n');
      await runCommand('node', ['test/performance/http-server.js']);
    }

    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error(`\n❌ Tests failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  console.error(`Error running tests: ${error.message}`);
  process.exit(1);
});
