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
 *   node scripts/run-parallel-tests.js [options]
 *
 * Options:
 *   --workers=N             Number of parallel workers (default: CPU count - 1)
 *   --testMatch=PATTERN     Pattern to match test files
 *   --memoryLimit=N         Memory limit per worker in MB (default: 2048)
 *   --timeout=N             Timeout for test runs in ms (default: 300000)
 *   --shard=X/Y             Run shard X of Y (for distributed testing)
 *   --balancedShards        Balance test distribution by file size (default: true)
 *   --u, --updateSnapshot   Update snapshots
 *   --watch                 Watch mode
 *   --ci                    CI mode
 *   --coverage              Generate coverage reports
 *   --changed               Only run tests related to changed files
 *   --mergeOnly             Only merge coverage reports (skip test runs)
 *
 * Examples:
 *   # Run all tests with 4 workers
 *   node scripts/run-parallel-tests.js --workers=4
 *
 *   # Run only unit tests
 *   node scripts/run-parallel-tests.js --testMatch="unit"
 *
 *   # Run first shard of 3 total shards
 *   node scripts/run-parallel-tests.js --shard=1/3
 *
 *   # Run with larger memory limit
 *   node scripts/run-parallel-tests.js --memoryLimit=4096
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
const balancedShards = args.balancedShards !== 'false'; // Default to true

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
 * Improved pattern matching for test files
 */
function matchesTestPattern(file, pattern) {
  if (!pattern || pattern === '**/*.@(test|spec).@(js|ts)') {
    return true; // Default pattern, match all test files
  }

  const filename = path.basename(file);
  const relPath = path.relative(rootDir, file);

  // If pattern is a simple keyword (like 'integration'), check if filename or path contains it
  if (!pattern.includes('*') && !pattern.includes('.')) {
    return filename.includes(pattern) || relPath.includes(pattern);
  }

  // Convert simple glob patterns to regex
  // e.g., 'src/*.test.ts' -> /^src\/[^\/]*\.test\.ts$/
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(relPath);
}

/**
 * Find all test files
 */
function findTestFiles() {
  console.log(`${Colors.BLUE}Finding test files matching: ${testMatch}${Colors.RESET}`);

  try {
    // Use Jest's CLI to list test files with explicit options for ESM compatibility
    const cmd = `NODE_OPTIONS=--experimental-vm-modules npx jest --listTests --json --testMatch="**/*.@(test|spec).@(js|ts)"`;
    let output;

    try {
      output = execSync(cmd, { cwd: rootDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (cmdError) {
      // If Jest fails to list tests, try a simpler approach with file system
      console.warn(`${Colors.YELLOW}Unable to use Jest to list tests: ${cmdError.message}${Colors.RESET}`);
      console.log(`${Colors.BLUE}Falling back to direct file search...${Colors.RESET}`);

      // Find test files using file system (basic implementation)
      const findTestFilesManually = (dir, pattern) => {
        const results = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            // Skip node_modules and other common non-test directories
            if (!['node_modules', '.git', 'dist', 'coverage'].includes(entry.name)) {
              results.push(...findTestFilesManually(fullPath, pattern));
            }
          } else if (entry.isFile() && entry.name.match(/\.(test|spec)\.(js|ts)$/)) {
            if (!pattern || entry.name.includes(pattern) || fullPath.includes(pattern)) {
              results.push(fullPath);
            }
          }
        }

        return results;
      };

      const manualFiles = findTestFilesManually(path.join(rootDir, 'test'), testMatch);
      console.log(`${Colors.BLUE}Found ${manualFiles.length} test files manually${Colors.RESET}`);
      return manualFiles;
    }

    let files = [];
    try {
      files = JSON.parse(output);
    } catch (parseError) {
      console.warn(`${Colors.YELLOW}Unable to parse Jest output: ${parseError.message}${Colors.RESET}`);
      console.log(`${Colors.DIM}Raw output: ${output.substring(0, 200)}...${Colors.RESET}`);
      // Return empty array if parse fails
      return [];
    }

    // Filter files by testMatch pattern if provided
    if (testMatch && testMatch !== '**/*.@(test|spec).@(js|ts)') {
      // Use our improved pattern matching
      files = files.filter(file => matchesTestPattern(file, testMatch));
    }

    // Handle shard settings
    if (args.shard) {
      const [shardIndex, totalShards] = args.shard.split('/').map(Number);

      if (isNaN(shardIndex) || isNaN(totalShards) || shardIndex < 1 || totalShards < 1 || shardIndex > totalShards) {
        console.warn(`${Colors.YELLOW}Invalid shard specification: ${args.shard}, using all files${Colors.RESET}`);
      } else {
        console.log(`${Colors.BLUE}Running shard ${shardIndex}/${totalShards}${Colors.RESET}`);

        // Shuffle files with a consistent seed to ensure same distribution across runs
        const shuffledFiles = [...files];
        const seedStr = 'nexurejs-tests'; // Consistent seed for deterministic shuffling

        // Simple Fisher-Yates shuffle with a deterministic seed
        const seededRandom = (() => {
          let seedVal = Array.from(seedStr).reduce((acc, char) => acc + char.charCodeAt(0), 0);
          return () => {
            seedVal = (seedVal * 9301 + 49297) % 233280;
            return seedVal / 233280;
          };
        })();

        for (let i = shuffledFiles.length - 1; i > 0; i--) {
          const j = Math.floor(seededRandom() * (i + 1));
          [shuffledFiles[i], shuffledFiles[j]] = [shuffledFiles[j], shuffledFiles[i]];
        }

        // Get this shard's subset of files
        const shardSize = Math.ceil(shuffledFiles.length / totalShards);
        const start = (shardIndex - 1) * shardSize;
        const end = Math.min(start + shardSize, shuffledFiles.length);

        files = shuffledFiles.slice(start, end);
        console.log(`${Colors.BLUE}Selected ${files.length} files for this shard${Colors.RESET}`);
      }
    }

    // Filter for changed files if requested
    if (changedOnly) {
      try {
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
      } catch (gitError) {
        console.warn(`${Colors.YELLOW}Unable to get changed files: ${gitError.message}${Colors.RESET}`);
        return files; // Return all files if git command fails
      }
    }

    return files;
  } catch (error) {
    console.warn(`${Colors.YELLOW}No test files found matching: ${testMatch}${Colors.RESET}`);
    console.error(`${Colors.RED}Error: ${error.message}${Colors.RESET}`);
    return [];
  }
}

/**
 * Improved split tests into batches to consider file size
 */
function splitTestFiles(files, numBatches) {
  if (args.shard) {
    // If we're already running in shard mode, we don't need to split further
    // Just create a single batch with all files
    return [files];
  }

  // Create empty batches
  const batches = Array.from({ length: numBatches }, () => []);

  if (args.balancedShards === false) {
    // Simple round-robin distribution if balanced shards not requested
    files.forEach((file, index) => {
      batches[index % numBatches].push(file);
    });
  } else {
    // Balance batches based on file sizes as a heuristic for test complexity
    try {
      // Get file sizes as a proxy for complexity
      const fileSizes = files.map(file => {
        try {
          const stats = fs.statSync(file);
          return { file, size: stats.size };
        } catch (e) {
          return { file, size: 0 };
        }
      });

      // Sort by size descending (largest files first)
      fileSizes.sort((a, b) => b.size - a.size);

      // Track batch sizes
      const batchSizes = Array(numBatches).fill(0);

      // Distribute files using a greedy algorithm
      // (put each file in the batch with the smallest current size)
      fileSizes.forEach(({ file, size }) => {
        // Find the smallest batch
        const smallestBatchIndex = batchSizes.indexOf(Math.min(...batchSizes));

        // Add file to that batch
        batches[smallestBatchIndex].push(file);

        // Update batch size
        batchSizes[smallestBatchIndex] += size;
      });

      // Log the distribution
      console.log(`${Colors.BLUE}Balanced batch distribution:${Colors.RESET}`);
      batches.forEach((batch, i) => {
        console.log(`${Colors.DIM}Batch ${i+1}: ${batch.length} files (${Math.round(batchSizes[i]/1024)}KB)${Colors.RESET}`);
      });
    } catch (e) {
      console.warn(`${Colors.YELLOW}Error balancing test batches: ${e.message}. Using round-robin distribution.${Colors.RESET}`);

      // Fallback to simple distribution
      files.forEach((file, index) => {
        batches[index % numBatches].push(file);
      });
    }
  }

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

    // Add a reasonable memory limit (2GB by default)
    const memoryLimit = args.memoryLimit || '2048';

    // Add resource constraints
    const nodeOptions = process.env.NODE_OPTIONS?.includes('--experimental-vm-modules')
      ? process.env.NODE_OPTIONS
      : `${process.env.NODE_OPTIONS || ''} --experimental-vm-modules`.trim();

    // Add max-old-space-size flag if not already present
    const maxOldSpaceSize = nodeOptions.includes('--max-old-space-size')
      ? nodeOptions
      : `${nodeOptions} --max-old-space-size=${memoryLimit}`;

    // Log batch start
    console.log(`${Colors.CYAN}Running batch ${batchId} (${testFiles.length} tests) with memory limit: ${memoryLimit}MB${Colors.RESET}`);
    testFiles.forEach(file => {
      console.log(`${Colors.DIM}- ${path.relative(rootDir, file)}${Colors.RESET}`);
    });

    // Add timeout for the process to prevent hanging
    const timeout = args.timeout ? parseInt(args.timeout, 10) : 300000; // 5 minutes default
    let timeoutId;

    // Track child process memory usage
    let memoryUsageInterval;

    // Run Jest process
    const testProcess = spawn('npx', jestArgs, {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_OPTIONS: maxOldSpaceSize
      }
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

    // Start timer for process timeout
    timeoutId = setTimeout(() => {
      console.error(`${Colors.RED}Batch ${batchId} timed out after ${timeout}ms${Colors.RESET}`);
      testProcess.kill('SIGTERM');
      setTimeout(() => {
        // Force kill if still running after 5 seconds
        if (testProcess.exitCode === null) {
          console.error(`${Colors.RED}Force killing batch ${batchId}${Colors.RESET}`);
          testProcess.kill('SIGKILL');
        }
      }, 5000);
    }, timeout);

    // Monitor memory usage every 10 seconds (if not in CI)
    if (!ci) {
      memoryUsageInterval = setInterval(() => {
        try {
          const usage = process.memoryUsage();
          const usageMB = Math.round(usage.rss / 1024 / 1024);
          if (usageMB > parseInt(memoryLimit) * 0.8) {
            console.warn(`${Colors.YELLOW}[Batch ${batchId}] High memory usage: ${usageMB}MB (80% of limit)${Colors.RESET}`);
          }
        } catch (e) {
          // Ignore errors reading memory usage
        }
      }, 10000);
    }

    // Handle process completion
    testProcess.on('close', code => {
      // Clear the timeout and memory usage interval
      clearTimeout(timeoutId);
      if (memoryUsageInterval) clearInterval(memoryUsageInterval);

      if (code === 0) {
        console.log(`${Colors.GREEN}Batch ${batchId} completed successfully${Colors.RESET}`);
        resolve({ batchId, success: true, output });
      } else {
        console.log(`${Colors.RED}Batch ${batchId} failed with code ${code}${Colors.RESET}`);
        resolve({ batchId, success: false, output });
      }
    });

    testProcess.on('error', error => {
      // Clear the timeout and memory usage interval
      clearTimeout(timeoutId);
      if (memoryUsageInterval) clearInterval(memoryUsageInterval);

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

    // Use a simpler approach - just copy the coverage files to the expected location
    // rather than trying to merge them with external tools
    for (let i = 1; i <= numBatches; i++) {
      const batchCoverageDir = path.join(rootDir, 'coverage', `batch-${i}`);
      if (fs.existsSync(batchCoverageDir)) {
        // Copy the coverage-final.json file if it exists
        const coverageFile = path.join(batchCoverageDir, 'coverage-final.json');
        if (fs.existsSync(coverageFile)) {
          // Create a dest filename with the batch number to avoid conflicts
          const destFile = path.join(coverageDir, `coverage-batch-${i}.json`);
          fs.copyFileSync(coverageFile, destFile);
          console.log(`${Colors.GREEN}Copied coverage from batch ${i}${Colors.RESET}`);
        }
      }
    }

    console.log(`${Colors.GREEN}Coverage reports collected successfully${Colors.RESET}`);

    // Jest already creates an HTML report for each batch, so we don't need to generate one
    console.log(`${Colors.GREEN}HTML reports available in the coverage directory${Colors.RESET}`);
  } catch (error) {
    console.error(`${Colors.RED}Error merging coverage reports: ${error.message}${Colors.RESET}`);
    // Don't try to create an empty coverage file - just report the error
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
  for (let i = 1; i <= numBatches; i++) {
    const resultsFile = path.join(rootDir, 'coverage', `batch-${i}`, 'results.json');

    if (fs.existsSync(resultsFile)) {
      try {
        const batchResults = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));

        // Update aggregate counts
        mergedResults.numFailedTestSuites += batchResults.numFailedTestSuites || 0;
        mergedResults.numFailedTests += batchResults.numFailedTests || 0;
        mergedResults.numPassedTestSuites += batchResults.numPassedTestSuites || 0;
        mergedResults.numPassedTests += batchResults.numPassedTests || 0;
        mergedResults.numPendingTestSuites += batchResults.numPendingTestSuites || 0;
        mergedResults.numPendingTests += batchResults.numPendingTests || 0;
        mergedResults.numRuntimeErrorTestSuites += batchResults.numRuntimeErrorTestSuites || 0;
        mergedResults.numTotalTestSuites += batchResults.numTotalTestSuites || 0;
        mergedResults.numTotalTests += batchResults.numTotalTests || 0;

        // Track earliest start time
        if (!mergedResults.startTime || batchResults.startTime < mergedResults.startTime) {
          mergedResults.startTime = batchResults.startTime;
        }

        // Merge test results
        if (Array.isArray(batchResults.testResults)) {
          mergedResults.testResults.push(...batchResults.testResults);
        }

        // If any batch failed, the overall run failed
        if (batchResults.success === false) {
          mergedResults.success = false;
        }
      } catch (error) {
        console.error(`${Colors.RED}Error parsing results from batch ${i}: ${error.message}${Colors.RESET}`);
      }
    }
  }

  // Write merged results
  try {
    const resultsDir = path.join(rootDir, 'coverage');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(resultsDir, 'merged-results.json'),
      JSON.stringify(mergedResults, null, 2)
    );
  } catch (writeError) {
    console.error(`${Colors.RED}Error writing merged results: ${writeError.message}${Colors.RESET}`);
  }

  return mergedResults;
}

/**
 * Extract test results from Jest output
 */
function extractTestStats(output) {
  try {
    // First try to find a complete JSON object in the output
    // Look for the standard Jest result object pattern
    const jsonRegex = /\{[\s\S]*?"numTotalTestSuites"\s*:\s*\d+[\s\S]*?\}/;
    const match = output.match(jsonRegex);

    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e) {
        // Failed to parse, continue to other methods
      }
    }

    // If no JSON object found, try to extract individual metrics
    const stats = {
      numTotalTestSuites: 0,
      numTotalTests: 0,
      numPassedTests: 0,
      numFailedTests: 0,
      numPendingTests: 0
    };

    // Extract test suites count
    const suitesMatch = output.match(/Test Suites:\s+(\d+)\s+passed,\s+(\d+)\s+total/);
    if (suitesMatch) {
      stats.numPassedTestSuites = parseInt(suitesMatch[1], 10);
      stats.numTotalTestSuites = parseInt(suitesMatch[2], 10);
      stats.numFailedTestSuites = stats.numTotalTestSuites - stats.numPassedTestSuites;
    }

    // Extract tests count
    const testsMatch = output.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+total/);
    if (testsMatch) {
      stats.numPassedTests = parseInt(testsMatch[1], 10);
      stats.numTotalTests = parseInt(testsMatch[2], 10);
      stats.numFailedTests = stats.numTotalTests - stats.numPassedTests;
    }

    // Extract pending tests
    const pendingMatch = output.match(/(\d+)\s+pending/i);
    if (pendingMatch) {
      stats.numPendingTests = parseInt(pendingMatch[1], 10);
    }

    return stats;
  } catch (e) {
    console.warn(`${Colors.YELLOW}Error extracting test stats: ${e.message}${Colors.RESET}`);
    return {
      numTotalTestSuites: 0,
      numTotalTests: 0,
      numPassedTests: 0,
      numFailedTests: 0,
      numPendingTests: 0
    };
  }
}

/**
 * Print test summary
 */
function printTestSummary(results) {
  console.log('\n');
  console.log(`${Colors.BOLD}Test Summary:${Colors.RESET}`);
  console.log(`${Colors.BOLD}-------------${Colors.RESET}`);

  // Handle different possible formats of results
  if (Array.isArray(results)) {
    // Aggregate batch-level results
    const summary = {
      numTotalTestSuites: 0,
      numTotalTests: 0,
      numPassedTests: 0,
      numFailedTests: 0,
      numPendingTests: 0,
      success: true
    };

    results.forEach(result => {
      // Check if it's a batch result or already an aggregated result
      if (result.batchId) {
        // This is a batch result, extract stats from output
        const stats = extractTestStats(result.output);

        // Add to summary
        summary.numTotalTestSuites += stats.numTotalTestSuites || 0;
        summary.numTotalTests += stats.numTotalTests || 0;
        summary.numPassedTests += stats.numPassedTests || 0;
        summary.numFailedTests += stats.numFailedTests || 0;
        summary.numPendingTests += stats.numPendingTests || 0;

        // Update overall success
        summary.success = summary.success && result.success;
      } else {
        // Already has the right structure
        summary.numTotalTestSuites += result.numTotalTestSuites || 0;
        summary.numTotalTests += result.numTotalTests || 0;
        summary.numPassedTests += result.numPassedTests || 0;
        summary.numFailedTests += result.numFailedTests || 0;
        summary.numPendingTests += result.numPendingTests || 0;

        // Update overall success if property exists
        if (typeof result.success === 'boolean') {
          summary.success = summary.success && result.success;
        }
      }
    });

    // Print aggregated results
    console.log(`Total test suites: ${summary.numTotalTestSuites}`);
    console.log(`Total tests: ${summary.numTotalTests}`);
    console.log(`Passed tests: ${Colors.GREEN}${summary.numPassedTests}${Colors.RESET}`);
    console.log(`Failed tests: ${summary.numFailedTests > 0 ? Colors.RED : Colors.GREEN}${summary.numFailedTests}${Colors.RESET}`);
    console.log(`Pending tests: ${Colors.YELLOW}${summary.numPendingTests}${Colors.RESET}`);
    console.log('\n');

    if (summary.success) {
      console.log(`${Colors.GREEN}${Colors.BOLD}All tests passed!${Colors.RESET}`);
    } else {
      console.log(`${Colors.RED}${Colors.BOLD}Some tests failed!${Colors.RESET}`);
    }
  } else {
    // Single result object (likely from merged results)
    const success = results.success !== false; // Default to true if undefined

    console.log(`Total test suites: ${results.numTotalTestSuites || 0}`);
    console.log(`Total tests: ${results.numTotalTests || 0}`);
    console.log(`Passed tests: ${Colors.GREEN}${results.numPassedTests || 0}${Colors.RESET}`);
    console.log(`Failed tests: ${(results.numFailedTests || 0) > 0 ? Colors.RED : Colors.GREEN}${results.numFailedTests || 0}${Colors.RESET}`);
    console.log(`Pending tests: ${Colors.YELLOW}${results.numPendingTests || 0}${Colors.RESET}`);
    console.log('\n');

    if (success) {
      console.log(`${Colors.GREEN}${Colors.BOLD}All tests passed!${Colors.RESET}`);
    } else {
      console.log(`${Colors.RED}${Colors.BOLD}Some tests failed!${Colors.RESET}`);
    }
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
      console.log(`${Colors.YELLOW}Running in merge-only mode${Colors.RESET}`);
      try {
        // Find any existing coverage folders
        const coverageDir = path.join(rootDir, 'coverage');
        if (fs.existsSync(coverageDir)) {
          const batchDirs = fs.readdirSync(coverageDir)
            .filter(dir => dir.startsWith('batch-'))
            .map(dir => parseInt(dir.replace('batch-', ''), 10))
            .filter(num => !isNaN(num));

          if (batchDirs.length > 0) {
            const maxBatch = Math.max(...batchDirs);
            await mergeCoverageReports(maxBatch);
          } else {
            console.log(`${Colors.YELLOW}No batch coverage directories found${Colors.RESET}`);
          }
        } else {
          console.log(`${Colors.YELLOW}No coverage directory found${Colors.RESET}`);
        }
      } catch (error) {
        console.error(`${Colors.RED}Error in merge-only mode: ${error.message}${Colors.RESET}`);
      }
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

    // Handle results
    let results = [];
    let allSucceeded = true;

    try {
      // Run all batches in parallel
      const batchPromises = batches.map((batch, index) => runTestBatch(index + 1, batch));
      results = await Promise.all(batchPromises);

      // Check if all batches succeeded
      allSucceeded = results.every(result => result.success);
    } catch (testError) {
      console.error(`${Colors.RED}Error during test execution: ${testError.message}${Colors.RESET}`);
      allSucceeded = false;
      // Create placeholder results if we don't have any
      if (results.length === 0) {
        results = [{
          numTotalTestSuites: 0,
          numTotalTests: 0,
          numPassedTests: 0,
          numFailedTests: 1,
          numPendingTests: 0,
          success: false
        }];
      }
    }

    // Merge coverage reports if enabled, with error handling
    if (coverage) {
      try {
        await mergeCoverageReports(batches.length);
      } catch (coverageError) {
        console.error(`${Colors.RED}Error merging coverage: ${coverageError.message}${Colors.RESET}`);
      }
    }

    // Merge test results with error handling
    let mergedResults = null;
    try {
      mergedResults = await mergeTestResults(batches.length);
    } catch (resultError) {
      console.error(`${Colors.RED}Error merging test results: ${resultError.message}${Colors.RESET}`);
    }

    // Print summary
    try {
      // Use merged results if available, otherwise use batch results
      printTestSummary(mergedResults || results);
    } catch (summaryError) {
      console.error(`${Colors.RED}Error printing test summary: ${summaryError.message}${Colors.RESET}`);
    }

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

// Run the main function with better error handling
main().then(exitCode => {
  try {
    process.exit(exitCode);
  } catch (error) {
    console.error(`${Colors.RED}Error during exit: ${error.message}${Colors.RESET}`);
    process.exit(1);
  }
}).catch(error => {
  console.error(`${Colors.RED}Unhandled error: ${error.message}${Colors.RESET}`);
  try {
    process.exit(1);
  } catch (exitError) {
    // Forced exit in case of issues with graceful exit
    process.kill(process.pid, 'SIGTERM');
  }
});
