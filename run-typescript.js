/**
 * NexureJS TypeScript Runner
 *
 * This script allows running TypeScript files directly without compiling them first.
 * It uses ts-node to execute TypeScript files.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Colors for console output
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

// Log with color
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Check if ts-node is installed
function checkTsNode() {
  try {
    require.resolve('ts-node');
    return true;
  } catch (error) {
    return false;
  }
}

// Main function
function main() {
  // Get the TypeScript file to run
  const tsFile = process.argv[2];

  if (!tsFile) {
    log('Error: No TypeScript file specified', colors.red);
    log('Usage: node run-typescript.js <typescript-file>', colors.yellow);
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), tsFile);

  // Check if the file exists
  if (!fs.existsSync(filePath)) {
    log(`Error: File not found: ${filePath}`, colors.red);
    process.exit(1);
  }

  // Check if ts-node is installed
  if (!checkTsNode()) {
    log('ts-node is not installed. Installing...', colors.yellow);
    require('child_process').execSync('npm install --no-save ts-node', { stdio: 'inherit' });
  }

  // Additional arguments to pass to the script
  const scriptArgs = process.argv.slice(3);

  // Run the TypeScript file with ts-node
  log(`Running: ${tsFile}`, colors.cyan);

  const nodeProcess = spawn('node', [
    '--loader', 'ts-node/esm',
    filePath,
    ...scriptArgs
  ], {
    stdio: 'inherit',
    env: {
      ...process.env,
      TS_NODE_PROJECT: path.resolve(process.cwd(), 'tsconfig.json')
    }
  });

  // Handle process exit
  nodeProcess.on('close', (code) => {
    if (code === 0) {
      log(`Script ${tsFile} completed successfully`, colors.green);
    } else {
      log(`Script ${tsFile} exited with code ${code}`, colors.red);
      process.exit(code);
    }
  });

  // Handle process errors
  nodeProcess.on('error', (error) => {
    log(`Error running script: ${error.message}`, colors.red);
    process.exit(1);
  });
}

// Run the main function
main();
