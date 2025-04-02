#!/usr/bin/env node

/**
 * Benchmark Results Comparison Script
 *
 * This script compares current benchmark results with previous runs to identify
 * performance improvements or regressions.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const benchmarkResultsDir = path.join(rootDir, 'benchmark-results');

// ANSI color codes for console output
const Colors = {
  RESET: '\x1b[0m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  BOLD: '\x1b[1m'
};

/**
 * Print a section header
 */
function printSectionHeader(title) {
  console.log(`\n${Colors.CYAN}${Colors.BOLD}${title}${Colors.RESET}`);
  console.log(`${Colors.CYAN}${'='.repeat(title.length)}${Colors.RESET}`);
}

/**
 * Check if benchmark results directory exists
 */
function checkBenchmarkResultsDir() {
  if (!fs.existsSync(benchmarkResultsDir)) {
    console.log(`${Colors.YELLOW}No benchmark results directory found. Creating one...${Colors.RESET}`);
    fs.mkdirSync(benchmarkResultsDir, { recursive: true });
    return false;
  }
  return true;
}

/**
 * Get the latest benchmark results file
 */
function getLatestBenchmarkResults() {
  if (!checkBenchmarkResultsDir()) return null;

  const files = fs.readdirSync(benchmarkResultsDir)
    .filter(file => file.endsWith('.json'))
    .sort((a, b) => {
      const statsA = fs.statSync(path.join(benchmarkResultsDir, a));
      const statsB = fs.statSync(path.join(benchmarkResultsDir, b));
      return statsB.mtime.getTime() - statsA.mtime.getTime(); // Sort by date, newest first
    });

  if (files.length === 0) {
    console.log(`${Colors.YELLOW}No benchmark results files found.${Colors.RESET}`);
    return null;
  }

  const latestFile = files[0];
  console.log(`${Colors.BLUE}Latest benchmark results file: ${latestFile}${Colors.RESET}`);

  try {
    return JSON.parse(fs.readFileSync(path.join(benchmarkResultsDir, latestFile), 'utf8'));
  } catch (error) {
    console.error(`${Colors.RED}Error parsing latest benchmark results:${Colors.RESET}`, error);
    return null;
  }
}

/**
 * Get the previous benchmark results file
 */
function getPreviousBenchmarkResults() {
  if (!checkBenchmarkResultsDir()) return null;

  const files = fs.readdirSync(benchmarkResultsDir)
    .filter(file => file.endsWith('.json'))
    .sort((a, b) => {
      const statsA = fs.statSync(path.join(benchmarkResultsDir, a));
      const statsB = fs.statSync(path.join(benchmarkResultsDir, b));
      return statsB.mtime.getTime() - statsA.mtime.getTime(); // Sort by date, newest first
    });

  if (files.length < 2) {
    console.log(`${Colors.YELLOW}No previous benchmark results file found for comparison.${Colors.RESET}`);
    return null;
  }

  const previousFile = files[1]; // Second newest file
  console.log(`${Colors.BLUE}Previous benchmark results file: ${previousFile}${Colors.RESET}`);

  try {
    return JSON.parse(fs.readFileSync(path.join(benchmarkResultsDir, previousFile), 'utf8'));
  } catch (error) {
    console.error(`${Colors.RED}Error parsing previous benchmark results:${Colors.RESET}`, error);
    return null;
  }
}

/**
 * Compare benchmark results and generate report
 */
function compareBenchmarks(current, previous) {
  if (!current || !previous) {
    console.log(`${Colors.YELLOW}Cannot compare benchmark results. Missing data.${Colors.RESET}`);
    return;
  }

  printSectionHeader('Benchmark Comparison');

  const comparison = {};
  let hasRegression = false;

  // Compare benchmarks
  for (const [benchmarkName, currentResults] of Object.entries(current)) {
    if (benchmarkName === 'metadata') continue; // Skip metadata

    if (!previous[benchmarkName]) {
      console.log(`${Colors.YELLOW}No previous data for benchmark: ${benchmarkName}${Colors.RESET}`);
      continue;
    }

    const previousResults = previous[benchmarkName];
    comparison[benchmarkName] = {};

    // Compare metrics (requests per second, latency, etc.)
    for (const [metricName, currentValue] of Object.entries(currentResults)) {
      if (typeof currentValue !== 'number') continue; // Skip non-numeric metrics

      const previousValue = previousResults[metricName];
      if (typeof previousValue !== 'number') continue;

      const diff = currentValue - previousValue;
      const percentChange = (diff / previousValue) * 100;

      comparison[benchmarkName][metricName] = {
        current: currentValue,
        previous: previousValue,
        diff,
        percentChange
      };

      // Check for regressions (negative change in key metrics)
      if (metricName === 'requestsPerSecond' && percentChange < -5) {
        hasRegression = true;
      }
    }
  }

  // Print comparison report
  for (const [benchmarkName, metrics] of Object.entries(comparison)) {
    console.log(`\n${Colors.BOLD}${benchmarkName}${Colors.RESET}`);

    for (const [metricName, results] of Object.entries(metrics)) {
      const { current, previous, diff, percentChange } = results;

      // Format results with colors based on improvement or regression
      let color = Colors.RESET;

      // For requestsPerSecond, higher is better
      if (metricName === 'requestsPerSecond') {
        color = percentChange >= 0 ? Colors.GREEN : Colors.RED;
      }
      // For latency metrics, lower is better
      else if (metricName.includes('latency')) {
        color = percentChange <= 0 ? Colors.GREEN : Colors.RED;
      }

      console.log(`  ${metricName}: ${color}${current.toFixed(2)} (${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(2)}%)${Colors.RESET}`);
    }
  }

  // Summary
  console.log(`\n${Colors.BOLD}Summary:${Colors.RESET}`);
  if (hasRegression) {
    console.log(`${Colors.RED}Performance regression detected! Check the report above for details.${Colors.RESET}`);
  } else {
    console.log(`${Colors.GREEN}No significant performance regressions detected.${Colors.RESET}`);
  }

  return comparison;
}

/**
 * Save comparison results to file
 */
function saveComparisonResults(comparison) {
  if (!comparison) return;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const comparisonFile = path.join(benchmarkResultsDir, `comparison-${timestamp}.json`);

  fs.writeFileSync(comparisonFile, JSON.stringify(comparison, null, 2));
  console.log(`${Colors.BLUE}Comparison results saved to: ${comparisonFile}${Colors.RESET}`);
}

/**
 * Main function
 */
async function main() {
  try {
    const currentResults = getLatestBenchmarkResults();
    const previousResults = getPreviousBenchmarkResults();

    const comparison = compareBenchmarks(currentResults, previousResults);
    saveComparisonResults(comparison);

  } catch (error) {
    console.error(`${Colors.RED}Error comparing benchmark results:${Colors.RESET}`, error);
    process.exit(1);
  }
}

// Run the script
main();
