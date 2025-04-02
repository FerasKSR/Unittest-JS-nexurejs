/**
 * Node.js Version Check Tool
 *
 * This script checks if the current Node.js version is compatible with NexureJS.
 * NexureJS requires Node.js 16.14.0 or later.
 */

'use strict';

const NODE_VERSION = process.version;
const NODE_MAJOR_VERSION = parseInt(NODE_VERSION.substring(1).split('.')[0], 10);
const NODE_MINOR_VERSION = parseInt(NODE_VERSION.substring(1).split('.')[1], 10);
const NODE_PATCH_VERSION = parseInt(NODE_VERSION.substring(1).split('.')[2], 10);

// Minimum supported Node.js version
const MIN_MAJOR = 16;
const MIN_MINOR = 14;
const MIN_PATCH = 0;

function checkNodeVersion() {
  console.log(`Checking Node.js version compatibility...`);
  console.log(`Current Node.js version: ${NODE_VERSION}`);
  console.log(`Required minimum version: v${MIN_MAJOR}.${MIN_MINOR}.${MIN_PATCH}`);

  // Major version check
  if (NODE_MAJOR_VERSION < MIN_MAJOR) {
    console.error(`Error: Node.js version ${NODE_VERSION} is not supported. Please use v${MIN_MAJOR}.${MIN_MINOR}.${MIN_PATCH} or later.`);
    process.exit(1);
  }

  // Minor version check (only if major version matches minimum)
  if (NODE_MAJOR_VERSION === MIN_MAJOR && NODE_MINOR_VERSION < MIN_MINOR) {
    console.error(`Error: Node.js version ${NODE_VERSION} is not supported. Please use v${MIN_MAJOR}.${MIN_MINOR}.${MIN_PATCH} or later.`);
    process.exit(1);
  }

  // Patch version check (only if major and minor match minimum)
  if (NODE_MAJOR_VERSION === MIN_MAJOR && NODE_MINOR_VERSION === MIN_MINOR && NODE_PATCH_VERSION < MIN_PATCH) {
    console.error(`Error: Node.js version ${NODE_VERSION} is not supported. Please use v${MIN_MAJOR}.${MIN_MINOR}.${MIN_PATCH} or later.`);
    process.exit(1);
  }

  console.log(`Success: Node.js version ${NODE_VERSION} is compatible with NexureJS.`);
  return true;
}

// Run the check
checkNodeVersion();

// Export for testing - handle both ESM and CommonJS
const exportObj = {
  checkNodeVersion,
  MIN_MAJOR,
  MIN_MINOR,
  MIN_PATCH,
  NODE_VERSION,
  NODE_MAJOR_VERSION,
  NODE_MINOR_VERSION,
  NODE_PATCH_VERSION
};

// Handle both ESM and CommonJS
if (typeof module !== 'undefined') {
  module.exports = exportObj;
}

export default exportObj;
