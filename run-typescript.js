/**
 * NexureJS TypeScript Runner
 *
 * This script allows running TypeScript files directly without compiling them first.
 * It uses ts-node to execute TypeScript files and supports path aliases from tsconfig.json.
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

// Get the TypeScript file to run from command line arguments
const tsFile = process.argv[2];

if (!tsFile) {
  log('Error: No TypeScript file specified', colors.red);
  log('Usage: node run-typescript.js <typescript-file>', colors.yellow);
  process.exit(1);
}

// Check if the file exists
const filePath = path.resolve(process.cwd(), tsFile);
if (!fs.existsSync(filePath)) {
  log(`Error: File not found: ${filePath}`, colors.red);
  process.exit(1);
}

// Check if ts-node is installed
try {
  require.resolve('ts-node');
} catch (error) {
  log('Error: ts-node is not installed', colors.red);
  log('Please install it with: npm install -D ts-node', colors.yellow);
  process.exit(1);
}

// Check if tsconfig-paths is installed
try {
  require.resolve('tsconfig-paths');
} catch (error) {
  log('Warning: tsconfig-paths is not installed', colors.yellow);
  log('Path aliases in tsconfig.json may not work correctly', colors.yellow);
  log('Install it with: npm install -D tsconfig-paths', colors.yellow);
}

// Build the command to run the TypeScript file
const nodeArgs = [
  '--require', 'ts-node/register',
  '--require', 'tsconfig-paths/register',
  filePath,
  ...process.argv.slice(3) // Pass any additional arguments
];

log(`Running: ${tsFile}`, colors.cyan);

// Spawn a new Node.js process to run the TypeScript file
const child = spawn(process.execPath, nodeArgs, {
  stdio: 'inherit',
  env: {
    ...process.env,
    TS_NODE_PROJECT: path.resolve(process.cwd(), 'tsconfig.json')
  }
});

// Handle process exit
child.on('close', (code) => {
  if (code === 0) {
    log(`Successfully executed: ${tsFile}`, colors.green);
  } else {
    log(`Execution failed with code: ${code}`, colors.red);
  }
  process.exit(code);
});

// Handle process errors
child.on('error', (error) => {
  log(`Error executing TypeScript file: ${error.message}`, colors.red);
  process.exit(1);
});
