/**
 * NexureJS Native Module Build Script
 *
 * This script builds the native module for testing purposes.
 * It uses node-gyp to compile the C++ code and then tests if the module can be loaded.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create require function for loading native modules
const require = createRequire(import.meta.url);

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

// Check if node-gyp is installed
function checkNodeGyp() {
  try {
    execSync('node-gyp --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// Build the native module
function buildNativeModule() {
  log('Building native module...', colors.cyan);

  try {
    // Clean previous builds
    execSync('node-gyp clean', { stdio: 'inherit' });

    // Configure the build
    execSync('node-gyp configure', { stdio: 'inherit' });

    // Build the module
    execSync('node-gyp build', { stdio: 'inherit' });

    log('Native module built successfully!', colors.green);
    return true;
  } catch (error) {
    log(`Error building native module: ${error.message}`, colors.red);
    return false;
  }
}

// Test if the native module can be loaded
function testNativeModule() {
  const buildPath = path.join(__dirname, 'build', 'Release');
  const modulePath = path.join(buildPath, 'nexurejs_native.node');

  if (!fs.existsSync(modulePath)) {
    log(`Native module not found at ${modulePath}`, colors.red);
    return false;
  }

  try {
    const nativeModule = require(modulePath);

    if (typeof nativeModule.isAvailable !== 'function' || !nativeModule.isAvailable()) {
      log('Native module loaded but isAvailable check failed', colors.yellow);
      return false;
    }

    log('Native module loaded and verified successfully!', colors.green);
    log(`Module version: ${nativeModule.version}`, colors.cyan);

    // Test each component
    if (nativeModule.HttpParser) {
      log('HttpParser is available', colors.green);
    }

    if (nativeModule.RadixRouter) {
      log('RadixRouter is available', colors.green);
    }

    if (nativeModule.JsonProcessor) {
      log('JsonProcessor is available', colors.green);
    }

    return true;
  } catch (error) {
    log(`Error loading native module: ${error.message}`, colors.red);
    return false;
  }
}

// Main function
function main() {
  log('NexureJS Native Module Build Test', colors.bright + colors.blue);
  log('================================', colors.bright + colors.blue);

  // Check if node-gyp is installed
  if (!checkNodeGyp()) {
    log('node-gyp is not installed. Please install it with: npm install -g node-gyp', colors.red);
    process.exit(1);
  }

  // Build the native module
  const buildSuccess = buildNativeModule();
  if (!buildSuccess) {
    log('Failed to build native module', colors.red);
    process.exit(1);
  }

  // Test the native module
  const testSuccess = testNativeModule();
  if (!testSuccess) {
    log('Native module test failed', colors.red);
    process.exit(1);
  }

  log('Build and test completed successfully!', colors.bright + colors.green);
}

// Run the main function
main();
