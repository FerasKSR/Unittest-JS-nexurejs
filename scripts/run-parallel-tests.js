#!/usr/bin/env node

/**
 * Parallel Test Runner
 *
 * This script runs tests in parallel for better performance by:
 * 1. Splitting tests into batches
 * 2. Running each batch in a separate process
 * 3. Collecting and merging results
 * 4. Generating a unified report
 *
 * Usage:
 *   node scripts/run-parallel-tests.js [--workers=4] [--testMatch=".test.js"]
 */

import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import os from 'os';

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Parse command line arguments
const args = parseArgs(process.argv.slice(2));
const numWorkers = parseInt(args.workers || Math.max(os.cpus().length - 1, 1), 10);
const testMatch = args.testMatch || '**/*.@(test|spec).@(js|ts)';
const updateSnapshots = args.u || args.updateSnapshot || false;
const watch = args.watch || false;
const ci = args.ci || false;
const coverage = args.coverage || false;
const changedOnly = args.changed || false;
const mergeOnly = args.mergeOnly || false;

// ANSI color codes for console output
const Colors = {
  RESET: '\x1b[0m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m'
};

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const result = {};
  args.forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      result[key] = value !== undefined ? value : true;
    } else if (arg.startsWith('-')) {
      const key = arg.substring(1);
      result[key] = true;
    }
  });
  return result;
}

/**
 * Find all test files
 */
function findTestFiles() {
  console.log(`${Colors.BLUE}Finding test files matching: ${testMatch}${Colors.RESET}`);

  try {
    // Use Jest's CLI to list test files
    const cmd = `npx jest --listTests --json --testMatch="**/*.@(test|spec).@(js|ts)"`;
    const output = execSync(cmd, { cwd: rootDir, encoding: 'utf8' });
    let files = [];

    try {
      files = JSON.parse(output);
    } catch (parseError) {
      console.warn(`${Colors.YELLOW}Unable to parse Jest output: ${parseError.message}${Colors.RESET}`);
      // Return empty array if parse fails
      return [];
    }

    // Filter files by testMatch pattern if provided
    if (testMatch && testMatch !== '**/*.@(test|spec).@(js|ts)') {
      // Simple pattern matching (could be enhanced with micromatch/minimatch)
      files = files.filter(file => {
        const filename = path.basename(file);
        const relPath = path.relative(rootDir, file);

        // If testMatch is a specific keyword (like 'integration'), check if filename contains it
        if (!testMatch.includes('*') && !testMatch.includes('.')) {
          return filename.includes(testMatch) || relPath.includes(testMatch);
        }

        // Otherwise use a simple pattern match
        return true; // Default to including all files
      });
    }

    // Filter for changed files if requested
    if (changedOnly) {
      const changedCmd = `git diff --name-only HEAD`;
      const changedOutput = execSync(changedCmd, { cwd: rootDir, encoding: 'utf8' });
      const changedFiles = changedOutput.split('\n').filter(Boolean);

      return files.filter(file => {
        const relativePath = path.relative(rootDir, file);
        return changedFiles.some(changed => {
          return relativePath.includes(changed) ||
                 changed.includes(path.basename(relativePath, path.extname(relativePath)));
        });
      });
    }

    return files;
  } catch (error) {
    console.warn(`${Colors.YELLOW}No test files found matching: ${testMatch}${Colors.RESET}`);
    console.error(`${Colors.RED}Error: ${error.message}${Colors.RESET}`);
    return [];
  }
}

/**
 * Split tests into batches
 */
function splitTestFiles(files, numBatches) {
  // Create empty batches
  const batches = Array.from({ length: numBatches }, () => []);

  // Distribute files among batches
  files.forEach((file, index) => {
    batches[index % numBatches].push(file);
  });

  // Remove empty batches
  return batches.filter(batch => batch.length > 0);
}

/**
 * Run a batch of tests
 */
function runTestBatch(batchId, testFiles) {
  return new Promise((resolve, reject) => {
    const coverageDir = path.join(rootDir, 'coverage');
    const outputDir = path.join(coverageDir, `batch-${batchId}`);

    // Ensure coverage directory exists
    if (coverage) {
      if (!fs.existsSync(coverageDir)) {
        fs.mkdirSync(coverageDir, { recursive: true });
      }
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
    }

    // Build Jest command arguments
    const jestArgs = [
      'jest',
      ...testFiles,
      '--colors',
      `--testNamePattern=${args.testNamePattern || ''}`,
      '--json',
      `--outputFile=${path.join(outputDir, 'results.json')}`
    ];

    if (coverage) {
      jestArgs.push(
        '--coverage',
        `--coverageDirectory=${outputDir}`,
        '--coverageReporters=json'
      );
    }

    if (updateSnapshots) {
      jestArgs.push('--updateSnapshot');
    }

    if (ci) {
      jestArgs.push('--ci');
    }

    // Log batch start
    console.log(`${Colors.CYAN}Running batch ${batchId} (${testFiles.length} tests)${Colors.RESET}`);
    testFiles.forEach(file => {
      console.log(`${Colors.DIM}- ${path.relative(rootDir, file)}${Colors.RESET}`);
    });

    // Run Jest process
    const testProcess = spawn('npx', jestArgs, {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';

    // Collect output
    testProcess.stdout.on('data', data => {
      const chunk = data.toString();
      output += chunk;

      // Print test progress in real-time
      if (!chunk.includes('{') && !chunk.includes('}')) {
        process.stdout.write(`${Colors.DIM}[Batch ${batchId}] ${Colors.RESET}${chunk}`);
      }
    });

    testProcess.stderr.on('data', data => {
      process.stderr.write(`${Colors.RED}[Batch ${batchId}] ${data.toString()}${Colors.RESET}`);
    });

    // Handle process completion
    testProcess.on('close', code => {
      if (code === 0) {
        console.log(`${Colors.GREEN}Batch ${batchId} completed successfully${Colors.RESET}`);
        resolve({ batchId, success: true, output });
      } else {
        console.log(`${Colors.RED}Batch ${batchId} failed with code ${code}${Colors.RESET}`);
        resolve({ batchId, success: false, output });
      }
    });

    testProcess.on('error', error => {
      console.error(`${Colors.RED}Batch ${batchId} error: ${error.message}${Colors.RESET}`);
      reject(error);
    });
  });
}

/**
 * Merge coverage reports
 */
async function mergeCoverageReports(numBatches) {
  console.log(`${Colors.BLUE}Merging coverage reports${Colors.RESET}`);

  try {
    // Create the output directory if it doesn't exist
    const coverageDir = path.join(rootDir, '.nyc_output');
    if (!fs.existsSync(coverageDir)) {
      fs.mkdirSync(coverageDir, { recursive: true });
    }

    // Check if we're running in merge-only mode
    if (mergeOnly) {
      // Check if test-results directory exists
      const testResultsDir = path.join(rootDir, 'test-results');
      if (fs.existsSync(testResultsDir)) {
        // Copy coverage files from test-results to .nyc_output
        const files = fs.readdirSync(testResultsDir, { recursive: true });
        for (const file of files) {
          if (file.endsWith('coverage-final.json')) {
            const sourcePath = path.join(testResultsDir, file);
            const destPath = path.join(coverageDir, path.basename(file));
            fs.copyFileSync(sourcePath, destPath);
            console.log(`${Colors.GREEN}Copied ${file} to .nyc_output${Colors.RESET}`);
          }
        }
      } else {
        console.warn(`${Colors.YELLOW}No test-results directory found for merge-only operation${Colors.RESET}`);
        // Create an empty coverage file as fallback
        fs.writeFileSync(path.join(coverageDir, 'coverage.json'), '{}');
      }

      return;
    }

    // Use istanbul to merge coverage reports
    let cmd = `npx istanbul-merge --out .nyc_output/coverage.json`;

    // Add all the batch coverage files
    let foundCoverageFiles = false;
    for (let i = 0; i < numBatches; i++) {
      const coverageFile = path.join(rootDir, 'coverage', `batch-${i}`, 'coverage-final.json');
      if (fs.existsSync(coverageFile)) {
        cmd += ` ${coverageFile}`;
        foundCoverageFiles = true;
      }
    }

    if (!foundCoverageFiles) {
      console.warn(`${Colors.YELLOW}No coverage files found to merge${Colors.RESET}`);
      // Create an empty coverage file as fallback
      fs.writeFileSync(path.join(coverageDir, 'coverage.json'), '{}');
      return;
    }

    // Run the merge command
    execSync(cmd, { cwd: rootDir, stdio: 'inherit' });

    // Generate HTML report
    execSync('npx istanbul report html', { cwd: rootDir, stdio: 'inherit' });

    console.log(`${Colors.GREEN}Coverage reports merged successfully${Colors.RESET}`);
    console.log(`${Colors.GREEN}HTML report available at: ${path.join(rootDir, 'coverage', 'index.html')}${Colors.RESET}`);
  } catch (error) {
    console.error(`${Colors.RED}Error merging coverage reports: ${error.message}${Colors.RESET}`);
    // Create an empty coverage file as fallback
    const coverageDir = path.join(rootDir, '.nyc_output');
    if (!fs.existsSync(coverageDir)) {
      fs.mkdirSync(coverageDir, { recursive: true });
    }
    fs.writeFileSync(path.join(coverageDir, 'coverage.json'), '{}');
  }
}

/**
 * Merge test results
 */
function mergeTestResults(numBatches) {
  console.log(`${Colors.BLUE}Merging test results${Colors.RESET}`);

  const mergedResults = {
    numFailedTestSuites: 0,
    numFailedTests: 0,
    numPassedTestSuites: 0,
    numPassedTests: 0,
    numPendingTestSuites: 0,
    numPendingTests: 0,
    numRuntimeErrorTestSuites: 0,
    numTotalTestSuites: 0,
    numTotalTests: 0,
    startTime: null,
    success: true,
    testResults: []
  };

  // Merge all batch results
  for (let i = 0; i < numBatches; i++) {
    const resultsFile = path.join(rootDir, 'coverage', `batch-${i}`, 'results.json');

    if (fs.existsSync(resultsFile)) {
      try {
        const batchResults = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));

        // Update aggregate counts
        mergedResults.numFailedTestSuites += batchResults.numFailedTestSuites;
        mergedResults.numFailedTests += batchResults.numFailedTests;
        mergedResults.numPassedTestSuites += batchResults.numPassedTestSuites;
        mergedResults.numPassedTests += batchResults.numPassedTests;
        mergedResults.numPendingTestSuites += batchResults.numPendingTestSuites;
        mergedResults.numPendingTests += batchResults.numPendingTests;
        mergedResults.numRuntimeErrorTestSuites += batchResults.numRuntimeErrorTestSuites;
        mergedResults.numTotalTestSuites += batchResults.numTotalTestSuites;
        mergedResults.numTotalTests += batchResults.numTotalTests;

        // Track earliest start time
        if (!mergedResults.startTime || batchResults.startTime < mergedResults.startTime) {
          mergedResults.startTime = batchResults.startTime;
        }

        // Merge test results
        mergedResults.testResults.push(...batchResults.testResults);

        // If any batch failed, the overall run failed
        if (!batchResults.success) {
          mergedResults.success = false;
        }
      } catch (error) {
        console.error(`${Colors.RED}Error parsing results from batch ${i}: ${error.message}${Colors.RESET}`);
      }
    }
  }

  // Write merged results
  fs.writeFileSync(
    path.join(rootDir, 'coverage', 'merged-results.json'),
    JSON.stringify(mergedResults, null, 2)
  );

  return mergedResults;
}

/**
 * Print test summary
 */
function printTestSummary(results) {
  console.log('\n');
  console.log(`${Colors.BOLD}Test Summary:${Colors.RESET}`);
  console.log(`${Colors.BOLD}-------------${Colors.RESET}`);
  console.log(`Total test suites: ${results.numTotalTestSuites}`);
  console.log(`Total tests: ${results.numTotalTests}`);
  console.log(`Passed tests: ${Colors.GREEN}${results.numPassedTests}${Colors.RESET}`);
  console.log(`Failed tests: ${results.numFailedTests > 0 ? Colors.RED : Colors.GREEN}${results.numFailedTests}${Colors.RESET}`);
  console.log(`Pending tests: ${Colors.YELLOW}${results.numPendingTests}${Colors.RESET}`);
  console.log('\n');

  if (results.success) {
    console.log(`${Colors.GREEN}${Colors.BOLD}All tests passed!${Colors.RESET}`);
  } else {
    console.log(`${Colors.RED}${Colors.BOLD}Some tests failed!${Colors.RESET}`);
    process.exit(1);
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log(`${Colors.BOLD}Parallel Test Runner${Colors.RESET}`);
    console.log(`Running tests with ${numWorkers} workers`);

    // If merge-only mode is enabled, just merge coverage reports and exit
    if (mergeOnly) {
      await mergeCoverageReports(0);
      return 0;
    }

    // Find test files
    const testFiles = findTestFiles();
    console.log(`${Colors.BLUE}Found ${testFiles.length} test files${Colors.RESET}`);

    // If no test files found, exit early (possibly with empty test report if needed)
    if (testFiles.length === 0) {
      if (coverage) {
        console.log(`${Colors.YELLOW}No test files found, creating empty coverage report${Colors.RESET}`);
        const nycDir = path.join(rootDir, '.nyc_output');
        if (!fs.existsSync(nycDir)) {
          fs.mkdirSync(nycDir, { recursive: true });
        }
        fs.writeFileSync(path.join(nycDir, 'coverage.json'), '{}');
      }
      return 0;
    }

    // Split into batches
    const batches = splitTestFiles(testFiles, Math.min(numWorkers, testFiles.length));
    console.log(`${Colors.BLUE}Running ${batches.length} batches in parallel${Colors.RESET}`);

    // Run all batches in parallel
    const batchPromises = batches.map((batch, index) => runTestBatch(index + 1, batch));
    const results = await Promise.all(batchPromises);

    // Check if all batches succeeded
    const allSucceeded = results.every(result => result.success);

    // Merge coverage reports if enabled
    if (coverage) {
      await mergeCoverageReports(batches.length);
    }

    // Merge test results
    await mergeTestResults(batches.length);

    // Print summary
    printTestSummary(results);

    // Return appropriate exit code
    return allSucceeded ? 0 : 1;
  } catch (error) {
    console.error(`${Colors.RED}Error running tests: ${error.message}${Colors.RESET}`);
    if (error.stack) {
      console.error(`${Colors.DIM}${error.stack}${Colors.RESET}`);
    }
    return 1;
  }
}

// Run the main function
main().then(exitCode => {
  process.exit(exitCode);
}).catch(error => {
  console.error(`${Colors.RED}Unhandled error: ${error.message}${Colors.RESET}`);
  process.exit(1);
});
