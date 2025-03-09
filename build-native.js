/**
 * NexureJS Native Module Build Script
 *
 * This script handles the building of native C++ modules for NexureJS.
 * It provides a convenient way to build and test the native modules.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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

// Execute a command and return its output
function execute(command, silent = false) {
  try {
    if (!silent) {
      log(`Executing: ${command}`, colors.dim);
    }
    return execSync(command, { stdio: silent ? 'ignore' : 'inherit' });
  } catch (error) {
    log(`Error executing command: ${command}`, colors.red);
    log(error.message, colors.red);
    return false;
  }
}

// Check if node-gyp is installed
function checkNodeGyp() {
  try {
    execSync('node-gyp --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// Check if necessary build tools are installed
function checkBuildTools() {
  log('Checking build prerequisites...', colors.cyan);

  // Check for node-gyp
  if (!checkNodeGyp()) {
    log('node-gyp is not installed. Installing...', colors.yellow);
    execute('npm install -g node-gyp');
  }

  // Check for python
  try {
    execSync('python --version || python3 --version', { stdio: 'ignore' });
  } catch (error) {
    log('Python is required for building native modules but was not found.', colors.red);
    log('Please install Python and try again.', colors.red);
    return false;
  }

  // Check for C++ compiler
  if (process.platform === 'win32') {
    try {
      execSync('cl', { stdio: 'ignore' });
    } catch (error) {
      log('Visual C++ build tools are required but not found.', colors.red);
      log('Please install Visual Studio Build Tools and try again.', colors.red);
      return false;
    }
  } else if (process.platform === 'darwin') {
    try {
      execSync('clang --version', { stdio: 'ignore' });
    } catch (error) {
      log('Clang compiler is required but not found.', colors.red);
      log('Please install Xcode Command Line Tools and try again.', colors.red);
      return false;
    }
  } else {
    try {
      execSync('g++ --version', { stdio: 'ignore' });
    } catch (error) {
      log('G++ compiler is required but not found.', colors.red);
      log('Please install build-essential package and try again.', colors.red);
      return false;
    }
  }

  log('All build prerequisites are met!', colors.green);
  return true;
}

// Clean build artifacts
function clean() {
  log('Cleaning previous build artifacts...', colors.cyan);

  const buildDir = path.join(__dirname, 'build');
  if (fs.existsSync(buildDir)) {
    if (process.platform === 'win32') {
      execute('rmdir /s /q build');
    } else {
      execute('rm -rf build');
    }
  }

  log('Build directory cleaned!', colors.green);
}

// Build the native modules
function build() {
  log('Building native modules...', colors.cyan);

  // Make sure node-addon-api is installed
  if (!fs.existsSync(path.join(__dirname, 'node_modules', 'node-addon-api'))) {
    log('Installing node-addon-api...', colors.yellow);
    execute('npm install node-addon-api');
  }

  // Run node-gyp configure and build
  if (!execute('node-gyp configure')) return false;
  if (!execute('node-gyp build')) return false;

  log('Native modules built successfully!', colors.green);
  return true;
}

// Test the native modules
function test() {
  log('Testing native modules...', colors.cyan);

  // Check if the built module exists
  const buildPath = path.join(__dirname, 'build', 'Release', 'nexurejs_native.node');
  if (!fs.existsSync(buildPath)) {
    log('Built module not found. Build may have failed.', colors.red);
    return false;
  }

  // Create a simple test script
  const testScript = `
    try {
      const native = require('./build/Release/nexurejs_native');
      console.log('Native module loaded successfully!');
      console.log('Available exports:', Object.keys(native));
      process.exit(0);
    } catch (error) {
      console.error('Failed to load native module:', error.message);
      process.exit(1);
    }
  `;

  fs.writeFileSync('test-native.js', testScript);

  // Run the test script
  const result = execute('node test-native.js');

  // Clean up
  fs.unlinkSync('test-native.js');

  if (result === false) {
    log('Native module test failed!', colors.red);
    return false;
  }

  log('Native module test passed!', colors.green);
  return true;
}

// Main function
function main() {
  log('NexureJS Native Module Build Script', colors.bright + colors.magenta);
  log('==============================\n', colors.magenta);

  if (!checkBuildTools()) {
    process.exit(1);
  }

  clean();

  if (!build()) {
    log('Build failed!', colors.red);
    process.exit(1);
  }

  if (!test()) {
    log('Tests failed!', colors.red);
    process.exit(1);
  }

  log('\n==============================', colors.magenta);
  log('Build and test completed successfully!', colors.bright + colors.green);
  log('The native modules are ready to use.', colors.green);
}

// Run the main function
main();
