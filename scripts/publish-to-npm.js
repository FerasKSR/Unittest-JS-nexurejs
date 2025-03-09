#!/usr/bin/env node

/**
 * NexureJS npm Publisher
 *
 * This script publishes the package to npm.
 *
 * Usage:
 *   node scripts/publish-to-npm.js
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Helper function to execute shell commands
function exec(command, options = {}) {
  log(`${colors.dim}> ${command}${colors.reset}`);
  return execSync(command, {
    stdio: options.silent ? 'pipe' : 'inherit',
    encoding: 'utf-8',
    ...options
  });
}

// Helper function to read package.json
function getPackageInfo() {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  return packageJson;
}

// Main function
async function main() {
  try {
    log(`${colors.bright}${colors.magenta}NexureJS npm Publisher${colors.reset}\n`);

    // Get version from package.json
    const packageInfo = getPackageInfo();
    const version = packageInfo.version;

    log(`Publishing version ${colors.bright}${version}${colors.reset} to npm`);

    // Check if user is logged in to npm
    try {
      exec('npm whoami', { silent: true });
      log(`You are logged in to npm.`, colors.green);
    } catch (error) {
      log(`${colors.yellow}You are not logged in to npm. Please login:${colors.reset}`);
      exec('npm login');
    }

    // Publish to npm
    try {
      exec('npm publish');
      log(`${colors.green}Successfully published to npm!${colors.reset}`);
    } catch (error) {
      if (error.message.includes('You cannot publish over the previously published versions')) {
        log(`${colors.yellow}Package version ${version} is already published to npm.${colors.reset}`);
      } else {
        throw error;
      }
    }

  } catch (error) {
    log(`${colors.red}Error: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Run the main function
main();
