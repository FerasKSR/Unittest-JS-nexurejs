/**
 * NexureJS Native Module Installer
 *
 * This script handles the installation of native modules.
 * It attempts to download prebuilt binaries for the current platform,
 * and falls back to building from source if necessary.
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { spawn } from 'child_process';
import { createGunzip } from 'zlib';
import tar from 'tar-pack';
import { fileURLToPath } from 'url';

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

// Get platform identifier
function getPlatformId() {
  const platform = process.platform;
  const arch = process.arch;

  // Map platform and architecture to supported platforms
  const platformMap = {
    'win32-x64': 'win32-x64',
    'darwin-x64': 'darwin-x64',
    'darwin-arm64': 'darwin-arm64',
    'linux-x64': 'linux-x64'
  };

  const platformId = `${platform}-${arch}`;
  return platformMap[platformId] || null;
}

// Download a file from a URL to a destination path
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);

    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        downloadFile(response.headers.location, dest)
          .then(resolve)
          .catch(reject);
        return;
      }

      // Check for successful response
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file: ${response.statusCode}`));
        return;
      }

      // Pipe the response to the file
      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });

      file.on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

// Download and extract a tarball from a URL to a destination path
function downloadAndExtractTarball(url, dest) {
  return new Promise((resolve, reject) => {
    log(`Downloading from ${url}`, colors.dim);

    // Create destination directory if it doesn't exist
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Download and extract the tarball
    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        downloadAndExtractTarball(response.headers.location, dest)
          .then(resolve)
          .catch(reject);
        return;
      }

      // Check for successful response
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download tarball: ${response.statusCode}`));
        return;
      }

      // Extract the tarball
      response
        .pipe(createGunzip())
        .pipe(tar.extract(destDir))
        .on('finish', resolve)
        .on('error', reject);
    }).on('error', reject);
  });
}

// Download prebuilt binary
async function downloadPrebuilt() {
  const platformId = getPlatformId();
  if (!platformId) {
    log(`Unsupported platform: ${process.platform}-${process.arch}`, colors.yellow);
    return false;
  }

  // Try to get version from package.json
  let version = '0.1.0';
  try {
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    version = packageJson.version || version;
  } catch (error) {
    log(`Could not read package.json, using default version ${version}`, colors.yellow);
  }

  const url = `https://github.com/nexurejs/nexurejs/releases/download/v${version}/nexurejs-native-${platformId}.tar.gz`;
  const dest = path.join(__dirname, '..', 'build', 'Release', 'nexurejs_native.node');

  try {
    log(`Downloading prebuilt binary for ${platformId}...`, colors.cyan);
    await downloadAndExtractTarball(url, dest);
    log('Prebuilt binary downloaded successfully!', colors.green);
    return true;
  } catch (error) {
    log(`Failed to download prebuilt binary: ${error.message}`, colors.yellow);
    log('Falling back to building from source...', colors.yellow);
    return false;
  }
}

// Build from source
function buildFromSource() {
  log('Building native module from source...', colors.cyan);

  // Check if node-gyp is installed
  let nodeGypInstalled = false;
  try {
    // Try to run node-gyp to check if it's installed
    const result = spawn('node-gyp', ['--version'], { stdio: 'pipe' });
    nodeGypInstalled = result.status === 0;
  } catch (error) {
    nodeGypInstalled = false;
  }

  if (!nodeGypInstalled) {
    log('node-gyp is not installed. Installing...', colors.yellow);
    spawn('npm', ['install', '--no-save', 'node-gyp'], { stdio: 'inherit' });
  }

  // Build the native module
  return new Promise((resolve, reject) => {
    const nodeGyp = spawn('node-gyp', ['rebuild'], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });

    nodeGyp.on('close', (code) => {
      if (code === 0) {
        log('Native module built successfully!', colors.green);
        resolve(true);
      } else {
        log(`Failed to build native module: exit code ${code}`, colors.red);
        resolve(false);
      }
    });

    nodeGyp.on('error', (error) => {
      log(`Error building native module: ${error.message}`, colors.red);
      resolve(false);
    });
  });
}

// Test the native module
async function testNativeModule() {
  const modulePath = path.join(__dirname, '..', 'build', 'Release', 'nexurejs_native.node');

  if (!fs.existsSync(modulePath)) {
    log(`Native module not found at ${modulePath}`, colors.red);
    return false;
  }

  try {
    // In ESM, we need to use node:module to load native modules
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);

    // Now use require to load the native module
    const nativeModule = require(modulePath);

    if (typeof nativeModule.isAvailable !== 'function' || !nativeModule.isAvailable()) {
      log('Native module loaded but isAvailable check failed', colors.yellow);
      return false;
    }

    log('Native module loaded and verified successfully!', colors.green);
    return true;
  } catch (error) {
    log(`Error loading native module: ${error.message}`, colors.red);
    return false;
  }
}

// Main function
async function main() {
  log('NexureJS Native Module Installer', colors.bright + colors.blue);
  log('==============================\n', colors.blue);

  // Skip if SKIP_NATIVE_BUILD environment variable is set
  if (process.env.SKIP_NATIVE_BUILD) {
    log('Skipping native module build (SKIP_NATIVE_BUILD is set)', colors.yellow);
    return;
  }

  // Try to download prebuilt binary
  const prebuiltSuccess = await downloadPrebuilt();

  // If prebuilt binary download failed, build from source
  let buildSuccess = prebuiltSuccess;
  if (!prebuiltSuccess) {
    buildSuccess = await buildFromSource();
  }

  // Test the native module
  if (buildSuccess) {
    const testSuccess = await testNativeModule();
    if (!testSuccess) {
      log('Native module test failed', colors.red);
      log('You may need to build the native module manually:', colors.yellow);
      log('  npm run build:native', colors.yellow);
    }
  } else {
    log('Native module installation failed', colors.red);
    log('You can try building manually:', colors.yellow);
    log('  npm run build:native', colors.yellow);
    log('Or skip native module installation:', colors.yellow);
    log('  SKIP_NATIVE_BUILD=1 npm install', colors.yellow);
  }
}

// Run the main function
main().catch((error) => {
  log(`Error: ${error.message}`, colors.red);
  process.exit(1);
});
