#!/usr/bin/env node

/**
 * Benchmark runner script for NexureJS
 *
 * This script helps run TypeScript benchmarks by using the correct ts-node configuration.
 * Usage: node run-benchmark.js [benchmark-file]
 * Example: node run-benchmark.js benchmarks/http-benchmark.ts
 */

import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Get the current directory
const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Parse arguments
const benchmarkFile = process.argv[2];

if (!benchmarkFile) {
  console.error('Please provide a benchmark file to run');
  console.error('Usage: node run-benchmark.js [benchmark-file]');
  console.error('Example: node run-benchmark.js benchmarks/http-benchmark.ts');
  process.exit(1);
}

// Resolve the full path
const fullPath = resolve(__dirname, benchmarkFile);

// Set up the configuration for ts-node
const tsNodeOptions = [
  '--esm',
  '--transpile-only',
  '--experimental-specifier-resolution=node'
];

// Run the benchmark
console.log(`Running benchmark: ${benchmarkFile}`);
const result = spawnSync('node', [
  '--no-warnings',
  ...tsNodeOptions.map(opt => `--require=ts-node/register ${opt}`),
  fullPath
], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    TS_NODE_PROJECT: join(__dirname, 'tsconfig.json'),
    TS_NODE_TRANSPILE_ONLY: 'true',
    TS_NODE_ESM: 'true'
  }
});

// Exit with the same code as the benchmark process
process.exit(result.status);
