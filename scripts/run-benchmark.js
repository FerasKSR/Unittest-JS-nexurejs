/**
 * NexureJS Benchmark Runner
 *
 * This script runs benchmarks and generates reports.
 * It can run individual benchmark files or all benchmarks.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Helper function for logging with colors
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Get the benchmark file to run from command line arguments
const benchmarkFile = process.argv[2];

// Available benchmarks
const availableBenchmarks = {
  'http': 'benchmarks/http-benchmark.ts',
  'json': 'benchmarks/json-benchmark.ts',
  'router': 'benchmarks/router-benchmark.ts',
  'worker': 'benchmarks/worker-pool-benchmark.ts',
  'v8': 'benchmarks/v8-optimizer-benchmark.ts',
  'native': 'benchmarks/native-benchmark.ts',
  'all': 'benchmarks/run-all.ts',
  'simple': 'benchmarks/simple-benchmark.ts'
};

// If no benchmark file is specified, show available benchmarks
if (!benchmarkFile) {
  log('NexureJS Benchmark Runner', colors.bright + colors.blue);
  log('======================\n', colors.blue);
  log('Available benchmarks:', colors.cyan);

  Object.keys(availableBenchmarks).forEach(name => {
    log(`  ${name}`, colors.yellow);
  });

  log('\nUsage: node run-benchmark.js <benchmark-name> [options]', colors.green);
  log('Example: node run-benchmark.js http --iterations=10000', colors.green);
  process.exit(0);
}

// Get the benchmark file path
const benchmarkPath = availableBenchmarks[benchmarkFile] || benchmarkFile;
const filePath = path.resolve(process.cwd(), benchmarkPath);

// Check if the file exists
if (!fs.existsSync(filePath)) {
  log(`Error: Benchmark file not found: ${filePath}`, colors.red);
  log('Available benchmarks:', colors.cyan);

  Object.keys(availableBenchmarks).forEach(name => {
    log(`  ${name}`, colors.yellow);
  });

  process.exit(1);
}

// Create benchmark results directory if it doesn't exist
const resultsDir = path.join(process.cwd(), 'benchmark-results');
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

// Parse additional options
const options = {};
process.argv.slice(3).forEach(arg => {
  if (arg.startsWith('--')) {
    const [key, value] = arg.substring(2).split('=');
    options[key] = value || true;
  }
});

// Generate a timestamp for the results file
const timestamp = new Date().toISOString().replace(/:/g, '-');
const resultsFile = path.join(resultsDir, `${benchmarkFile}-${timestamp}.json`);

// Set environment variables for the benchmark
const env = {
  ...process.env,
  BENCHMARK_RESULTS_FILE: resultsFile,
  BENCHMARK_ITERATIONS: options.iterations || '10000',
  BENCHMARK_WARMUP: options.warmup || '100',
  BENCHMARK_VERBOSE: options.verbose || 'false'
};

log(`Running benchmark: ${benchmarkFile}`, colors.cyan);
log(`Results will be saved to: ${resultsFile}`, colors.dim);

// Run the benchmark using the TypeScript runner
const child = spawn('node', ['run-typescript.js', filePath, ...process.argv.slice(3)], {
  stdio: 'inherit',
  env
});

// Handle process exit
child.on('close', (code) => {
  if (code === 0) {
    log(`Benchmark completed successfully`, colors.green);

    // Check if results file was created
    if (fs.existsSync(resultsFile)) {
      log(`Results saved to: ${resultsFile}`, colors.green);
    }
  } else {
    log(`Benchmark failed with code: ${code}`, colors.red);
  }
  process.exit(code);
});

// Handle process errors
child.on('error', (error) => {
  log(`Error running benchmark: ${error.message}`, colors.red);
  process.exit(1);
});
