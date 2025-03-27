#!/usr/bin/env node

/**
 * Script Runner
 *
 * Provides a unified interface for running various script operations
 * with improved performance and error handling.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Command line arguments
const ARGS = process.argv.slice(2);
const COMMAND = ARGS[0]?.toLowerCase();
const OPTIONS = ARGS.slice(1);
const VERBOSE = OPTIONS.includes('--verbose') || OPTIONS.includes('-v');
const HELP = OPTIONS.includes('--help') || OPTIONS.includes('-h');

/**
 * Show help message
 */
function showHelp() {
  console.log(`
Nexure.js Script Runner
-----------------------

Usage: node run-scripts.js <command> [options]

Commands:
  minify      Minify and optimize scripts for production
  benchmark   Run benchmark tests
  profile     Run performance profiling
  lint        Run linting and auto-fixes
  build       Build TypeScript files
  clean       Clean build artifacts
  help        Show this help message

Options:
  --verbose, -v  Show detailed output
  --help, -h     Show help for the specified command
  --dry-run      Show what would be done without making changes

Examples:
  node run-scripts.js minify
  node run-scripts.js benchmark http
  node run-scripts.js lint --fix
  node run-scripts.js build --watch
  `);
}

/**
 * Show command-specific help
 */
function showCommandHelp(command) {
  switch(command) {
    case 'minify':
      console.log(`
Minify Command
-------------
Minifies and optimizes scripts for production use.

Usage: node run-scripts.js minify [options]

Options:
  --verbose, -v  Show detailed output
  --dry-run      Show what would be done without making changes
  --all          Process all scripts, not just JS files
  --no-cache     Don't use cache when minifying

Examples:
  node run-scripts.js minify
  node run-scripts.js minify --dry-run
      `);
      break;

    case 'benchmark':
      console.log(`
Benchmark Command
----------------
Runs performance benchmarks for various parts of the framework.

Usage: node run-scripts.js benchmark [suite] [options]

Suites:
  http           HTTP parser benchmark
  json           JSON processor benchmark
  native         Compare native vs JavaScript implementations
  all            Run all benchmarks (default)

Options:
  --verbose, -v  Show detailed output
  --iterations=N Set number of iterations (default: 10000)
  --timeout=N    Set timeout in seconds (default: 30)

Examples:
  node run-scripts.js benchmark http
  node run-scripts.js benchmark json --iterations=20000
      `);
      break;

    case 'profile':
      console.log(`
Profile Command
--------------
Runs performance profiling to identify bottlenecks.

Usage: node run-scripts.js profile [options]

Options:
  --memory       Focus on memory profiling
  --cpu          Focus on CPU profiling
  --verbose, -v  Show detailed output
  --report       Generate detailed HTML report

Examples:
  node run-scripts.js profile --memory
  node run-scripts.js profile --cpu --report
      `);
      break;

    case 'lint':
      console.log(`
Lint Command
-----------
Runs ESLint to check and fix code style issues.

Usage: node run-scripts.js lint [options]

Options:
  --fix          Automatically fix problems when possible
  --watch        Watch files and re-lint on changes
  --verbose, -v  Show detailed output
  --auto-fix     Run the auto-fix script for unused variables
  --dry-run      Show what would be fixed without making changes

Examples:
  node run-scripts.js lint --fix
  node run-scripts.js lint --auto-fix
      `);
      break;

    case 'build':
      console.log(`
Build Command
------------
Builds TypeScript files into JavaScript.

Usage: node run-scripts.js build [options]

Options:
  --watch        Watch files and rebuild on changes
  --verbose, -v  Show detailed output
  --production   Build for production (minified)
  --native       Include native module compilation

Examples:
  node run-scripts.js build --watch
  node run-scripts.js build --production --native
      `);
      break;

    case 'clean':
      console.log(`
Clean Command
------------
Cleans build artifacts and temporary files.

Usage: node run-scripts.js clean [options]

Options:
  --all          Clean all generated files including node_modules
  --verbose, -v  Show detailed output
  --dry-run      Show what would be cleaned without deleting

Examples:
  node run-scripts.js clean
  node run-scripts.js clean --all
      `);
      break;

    default:
      showHelp();
      break;
  }
}

/**
 * Run a script with provided options
 */
function runScript(scriptPath, args = []) {
  try {
    console.log(`Running ${path.basename(scriptPath)}...`);

    // Add node executable and pass all relevant arguments
    const fullCommand = ['node', scriptPath, ...args];

    execSync(fullCommand.join(' '), {
      stdio: 'inherit',
      cwd: path.dirname(__dirname)
    });

    return true;
  } catch (error) {
    console.error(`Error running script: ${error.message}`);
    return false;
  }
}

/**
 * Execute minify command
 */
function executeMinify() {
  if (HELP) {
    showCommandHelp('minify');
    return;
  }

  // Prepare options for minify script
  const options = [];
  if (VERBOSE) options.push('--verbose');
  if (OPTIONS.includes('--dry-run')) options.push('--dry-run');
  if (OPTIONS.includes('--all')) options.push('--all');

  // Run the minify script
  const scriptPath = path.join(__dirname, 'minify-scripts.js');
  runScript(scriptPath, options);
}

/**
 * Execute benchmark command
 */
function executeBenchmark() {
  if (HELP) {
    showCommandHelp('benchmark');
    return;
  }

  // Determine which benchmark to run
  let benchmarkType = 'all';
  if (OPTIONS.includes('http')) benchmarkType = 'http';
  if (OPTIONS.includes('json')) benchmarkType = 'json';
  if (OPTIONS.includes('native')) benchmarkType = 'native';

  // Prepare options
  const options = [benchmarkType];

  // Extract iterations if provided
  const iterationsArg = OPTIONS.find(opt => opt.startsWith('--iterations='));
  if (iterationsArg) {
    const iterations = iterationsArg.split('=')[1];
    options.push(`--iterations=${iterations}`);
  }

  // Extract timeout if provided
  const timeoutArg = OPTIONS.find(opt => opt.startsWith('--timeout='));
  if (timeoutArg) {
    const timeout = timeoutArg.split('=')[1];
    options.push(`--timeout=${timeout}`);
  }

  if (VERBOSE) options.push('--verbose');

  // Run the benchmark script
  const scriptPath = path.join(__dirname, 'run-benchmark.js');
  runScript(scriptPath, options);
}

/**
 * Execute profile command
 */
function executeProfile() {
  if (HELP) {
    showCommandHelp('profile');
    return;
  }

  // Prepare options
  const options = [];

  if (OPTIONS.includes('--memory')) options.push('--memory');
  if (OPTIONS.includes('--cpu')) options.push('--cpu');
  if (OPTIONS.includes('--report')) options.push('--report');
  if (VERBOSE) options.push('--verbose');

  // Run the profiling script
  const scriptPath = path.join(__dirname, 'run-profiling.js');
  runScript(scriptPath, options);
}

/**
 * Execute lint command
 */
function executeLint() {
  if (HELP) {
    showCommandHelp('lint');
    return;
  }

  // Determine which lint command to run
  if (OPTIONS.includes('--auto-fix')) {
    // Run the fix-lint-issues script
    const options = [];
    if (OPTIONS.includes('--dry-run')) options.push('--dry-run');
    if (VERBOSE) options.push('--verbose');

    const scriptPath = path.join(__dirname, 'fix-lint-issues.js');
    runScript(scriptPath, options);
    return;
  }

  // For regular lint command
  const npmCommand = OPTIONS.includes('--fix')
    ? 'npm run lint:fix'
    : 'npm run lint';

  try {
    console.log(`Running ${npmCommand}...`);
    execSync(npmCommand, {
      stdio: 'inherit',
      cwd: path.dirname(__dirname)
    });
  } catch (error) {
    // ESLint may exit with non-zero code when it finds issues
    if (error.status !== 0) {
      console.log('Linting completed with issues');
    } else {
      console.error(`Error running lint: ${error.message}`);
    }
  }
}

/**
 * Execute build command
 */
function executeBuild() {
  if (HELP) {
    showCommandHelp('build');
    return;
  }

  // Build TypeScript files
  let tscCommand = 'npx tsc';
  if (OPTIONS.includes('--watch')) tscCommand += ' --watch';

  // Handle native module compilation
  if (OPTIONS.includes('--native')) {
    console.log('Building TypeScript and native modules...');

    try {
      // First build TypeScript
      console.log('Building TypeScript files...');
      execSync(tscCommand, {
        stdio: 'inherit',
        cwd: path.dirname(__dirname)
      });

      // Then build native modules
      console.log('Building native modules...');
      const nativeBuildScript = path.join(__dirname, 'build-native.js');

      const nativeOptions = [];
      if (OPTIONS.includes('--production')) nativeOptions.push('--release');
      if (VERBOSE) nativeOptions.push('--verbose');

      runScript(nativeBuildScript, nativeOptions);

    } catch (error) {
      console.error(`Error building: ${error.message}`);
    }
  } else {
    // Just build TypeScript
    try {
      console.log('Building TypeScript files...');
      execSync(tscCommand, {
        stdio: 'inherit',
        cwd: path.dirname(__dirname)
      });
    } catch (error) {
      console.error(`Error building TypeScript: ${error.message}`);
    }
  }
}

/**
 * Execute clean command
 */
function executeClean() {
  if (HELP) {
    showCommandHelp('clean');
    return;
  }

  const dryRun = OPTIONS.includes('--dry-run');
  const cleanAll = OPTIONS.includes('--all');

  console.log(`Cleaning${dryRun ? ' (dry run)' : ''}...`);

  // Define paths to clean
  const pathsToClean = [
    'dist',
    'build',
    '.nyc_output',
    'coverage',
    'benchmarks/*.cpuprofile',
    'benchmarks/memory-profiles',
    'benchmarks/profiling-results'
  ];

  // Add node_modules if --all option is provided
  if (cleanAll) {
    pathsToClean.push('node_modules');
  }

  // Process each path
  pathsToClean.forEach(relativePath => {
    const fullPath = path.join(path.dirname(__dirname), relativePath);

    // Handle glob patterns
    if (relativePath.includes('*')) {
      const dirPath = path.dirname(fullPath);
      const pattern = path.basename(fullPath);

      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath)
          .filter(file => file.match(pattern.replace('*', '.*')))
          .map(file => path.join(dirPath, file));

        files.forEach(file => {
          console.log(`Removing file: ${file}`);
          if (!dryRun) {
            try {
              fs.unlinkSync(file);
            } catch (err) {
              console.error(`Error removing file ${file}: ${err.message}`);
            }
          }
        });
      }

      return;
    }

    // Regular path (directory or file)
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        console.log(`Removing directory: ${fullPath}`);
        if (!dryRun) {
          try {
            // Use rimraf or equivalent for directory removal
            execSync(`rm -rf "${fullPath}"`, { stdio: 'inherit' });
          } catch (err) {
            console.error(`Error removing directory ${fullPath}: ${err.message}`);
          }
        }
      } else {
        console.log(`Removing file: ${fullPath}`);
        if (!dryRun) {
          try {
            fs.unlinkSync(fullPath);
          } catch (err) {
            console.error(`Error removing file ${fullPath}: ${err.message}`);
          }
        }
      }
    } else if (VERBOSE) {
      console.log(`Path does not exist: ${fullPath}`);
    }
  });

  console.log('Clean completed.');
}

/**
 * Main entry point
 */
function main() {
  // Handle help command or no command
  if (!COMMAND || COMMAND === 'help') {
    showHelp();
    return;
  }

  // Execute the appropriate command
  switch (COMMAND) {
    case 'minify':
      executeMinify();
      break;
    case 'benchmark':
      executeBenchmark();
      break;
    case 'profile':
      executeProfile();
      break;
    case 'lint':
      executeLint();
      break;
    case 'build':
      executeBuild();
      break;
    case 'clean':
      executeClean();
      break;
    default:
      console.error(`Unknown command: ${COMMAND}`);
      showHelp();
      process.exit(1);
  }
}

// Execute main function
main();
