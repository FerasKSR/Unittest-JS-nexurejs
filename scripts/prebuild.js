/**
 * NexureJS Native Module Prebuilder
 *
 * This script builds native modules for multiple platforms and architectures.
 * It's intended to be used in a CI environment to generate prebuilt binaries
 * that users can download instead of building from source.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createGzip } from 'zlib';
import tar from 'tar-stream';
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

// Execute a shell command
function execute(command, silent = false) {
  if (!silent) {
    log(`> ${command}`, colors.dim);
  }

  try {
    return execSync(command, {
      stdio: silent ? 'pipe' : 'inherit',
      encoding: 'utf-8'
    });
  } catch (error) {
    if (!silent) {
      log(`Command failed: ${error.message}`, colors.red);
    }
    throw error;
  }
}

// Create a tarball from a file
async function createTarball(sourceFile, targetFile) {
  return new Promise((resolve, reject) => {
    const pack = tar.pack();

    // Add the file to the tarball
    const sourceFileName = path.basename(sourceFile);
    const stat = fs.statSync(sourceFile);

    pack.entry({
      name: sourceFileName,
      size: stat.size,
      mode: stat.mode,
      mtime: stat.mtime
    }, fs.readFileSync(sourceFile));

    pack.finalize();

    // Create the output file
    const output = fs.createWriteStream(targetFile);
    const gzip = createGzip();

    pack.pipe(gzip).pipe(output);

    output.on('finish', resolve);
    output.on('error', reject);
  });
}

// Build for a specific platform and architecture
async function buildForPlatform(platform, arch) {
  log(`Building for ${platform}-${arch}...`, colors.cyan);

  // Set environment variables for cross-compilation
  const env = { ...process.env };

  if (platform === 'win32') {
    env.npm_config_target_platform = 'win32';
  } else if (platform === 'darwin') {
    env.npm_config_target_platform = 'darwin';
  } else if (platform === 'linux') {
    env.npm_config_target_platform = 'linux';
  }

  env.npm_config_target_arch = arch;

  // Clean previous builds
  try {
    execute('node-gyp clean', true);
  } catch (error) {
    log(`Warning: Failed to clean previous builds: ${error.message}`, colors.yellow);
  }

  // Configure and build
  try {
    execute('node-gyp configure', true);
    execute('node-gyp build', true);

    // Check if the build was successful
    const buildDir = path.join(__dirname, '..', 'build', 'Release');
    const nativeModulePath = path.join(buildDir, 'nexurejs_native.node');

    if (!fs.existsSync(nativeModulePath)) {
      throw new Error(`Native module not found at ${nativeModulePath}`);
    }

    // Create the prebuilds directory if it doesn't exist
    const prebuildsDir = path.join(__dirname, '..', 'prebuilds');
    if (!fs.existsSync(prebuildsDir)) {
      fs.mkdirSync(prebuildsDir, { recursive: true });
    }

    // Create a tarball of the native module
    const tarballPath = path.join(prebuildsDir, `nexurejs-native-${platform}-${arch}.tar.gz`);
    await createTarball(nativeModulePath, tarballPath);

    log(`Successfully built for ${platform}-${arch}`, colors.green);
    return true;
  } catch (error) {
    log(`Failed to build for ${platform}-${arch}: ${error.message}`, colors.red);
    return false;
  }
}

// Main function
async function main() {
  log('NexureJS Native Module Prebuilder', colors.bright + colors.blue);
  log('================================\n', colors.blue);

  // Check if node-gyp is installed
  try {
    execute('node-gyp --version', true);
  } catch (error) {
    log('node-gyp is not installed. Installing...', colors.yellow);
    execute('npm install --no-save node-gyp');
  }

  // Get package version
  let version = '0.1.0';
  try {
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    version = packageJson.version || version;
  } catch (error) {
    log(`Could not read package.json, using default version ${version}`, colors.yellow);
  }

  log(`Building native modules for version ${version}`, colors.cyan);

  // Define platforms to build for
  const currentPlatform = process.platform;
  const currentArch = process.arch;

  // By default, only build for the current platform
  const platforms = [
    { platform: currentPlatform, arch: currentArch }
  ];

  // If BUILD_ALL_PLATFORMS is set, build for all supported platforms
  if (process.env.BUILD_ALL_PLATFORMS) {
    platforms.push(
      { platform: 'win32', arch: 'x64' },
      { platform: 'darwin', arch: 'x64' },
      { platform: 'darwin', arch: 'arm64' },
      { platform: 'linux', arch: 'x64' }
    );

    // Remove duplicates
    const seen = new Set();
    const uniquePlatforms = platforms.filter(p => {
      const key = `${p.platform}-${p.arch}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    platforms.length = 0;
    platforms.push(...uniquePlatforms);
  }

  // Build for each platform
  const results = [];
  for (const { platform, arch } of platforms) {
    const success = await buildForPlatform(platform, arch);
    results.push({ platform, arch, success });
  }

  // Print build summary
  log('\nBuild Summary:', colors.bright);
  for (const { platform, arch, success } of results) {
    const status = success ? `${colors.green}Success${colors.reset}` : `${colors.red}Failed${colors.reset}`;
    log(`${platform}-${arch}: ${status}`);
  }

  // Check if any builds failed
  const anyFailed = results.some(r => !r.success);
  if (anyFailed) {
    log('\nSome builds failed. Check the logs for details.', colors.yellow);
    process.exit(1);
  } else {
    log('\nAll builds completed successfully!', colors.green);
  }
}

// Run the main function
main().catch(error => {
  log(`Error: ${error.message}`, colors.red);
  process.exit(1);
});
