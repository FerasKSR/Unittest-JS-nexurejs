/**
 * NexureJS Native Module Prebuilder
 *
 * This script builds native modules for multiple platforms and architectures.
 * It's intended to be used in a CI environment to generate prebuilt binaries
 * that users can download instead of building from source.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { createGzip } = require('zlib');
const tar = require('tar-stream');

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

// Create a tarball from a file
async function createTarball(sourceFile, targetFile) {
  return new Promise((resolve, reject) => {
    const pack = tar.pack();
    const gzip = createGzip();
    const writeStream = fs.createWriteStream(targetFile);

    // Add the file to the tarball
    const fileName = path.basename(sourceFile);
    const fileContent = fs.readFileSync(sourceFile);

    pack.entry({ name: fileName }, fileContent);
    pack.finalize();

    // Pipe the tarball to the output file
    pack.pipe(gzip).pipe(writeStream);

    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
}

// Build for a specific platform
async function buildForPlatform(platform, arch) {
  log(`Building for ${platform}-${arch}...`, colors.cyan);

  // Set environment variables for cross-compilation
  const env = { ...process.env };

  if (platform === 'win32') {
    env.npm_config_target_platform = 'win32';
    env.npm_config_target_arch = arch;
    env.npm_config_target_libc = 'msvc';
  } else if (platform === 'darwin') {
    env.npm_config_target_platform = 'darwin';
    env.npm_config_target_arch = arch;
  } else if (platform === 'linux') {
    env.npm_config_target_platform = 'linux';
    env.npm_config_target_arch = arch;
    env.npm_config_target_libc = 'glibc';
  }

  // Clean previous build
  execute('node-gyp clean', true);

  // Configure and build
  const configureResult = execute('node-gyp configure', true);
  if (!configureResult) {
    log(`Failed to configure for ${platform}-${arch}`, colors.red);
    return false;
  }

  const buildResult = execute('node-gyp build', true);
  if (!buildResult) {
    log(`Failed to build for ${platform}-${arch}`, colors.red);
    return false;
  }

  // Create output directory
  const outputDir = path.join(__dirname, '..', 'prebuilds');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Get version from package.json
  let version = '0.1.0';
  try {
    const packageJson = require('../package.json');
    version = packageJson.version || version;
  } catch (error) {
    log(`Could not read package.json, using default version ${version}`, colors.yellow);
  }

  // Create tarball
  const sourceFile = path.join(__dirname, '..', 'build', 'Release', 'nexurejs_native.node');
  const targetFile = path.join(outputDir, `nexurejs-native-${platform}-${arch}-${version}.tar.gz`);

  try {
    await createTarball(sourceFile, targetFile);
    log(`Created tarball: ${targetFile}`, colors.green);
    return true;
  } catch (error) {
    log(`Failed to create tarball: ${error.message}`, colors.red);
    return false;
  }
}

// Main function
async function main() {
  log('NexureJS Native Module Prebuilder', colors.bright + colors.blue);
  log('===============================\n', colors.blue);

  // Check if node-gyp is installed
  try {
    execSync('node-gyp --version', { stdio: 'ignore' });
  } catch (error) {
    log('node-gyp is not installed. Please install it with: npm install -g node-gyp', colors.red);
    process.exit(1);
  }

  // Define platforms to build for
  const platforms = [];

  // Always build for current platform
  platforms.push({
    platform: process.platform,
    arch: process.arch
  });

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
    const uniquePlatforms = [];

    for (const p of platforms) {
      const key = `${p.platform}-${p.arch}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniquePlatforms.push(p);
      }
    }

    platforms.length = 0;
    platforms.push(...uniquePlatforms);
  }

  log(`Building for ${platforms.length} platform(s):`, colors.cyan);
  platforms.forEach(p => log(`- ${p.platform}-${p.arch}`, colors.yellow));

  // Build for each platform
  const results = [];

  for (const { platform, arch } of platforms) {
    const success = await buildForPlatform(platform, arch);
    results.push({ platform, arch, success });
  }

  // Print summary
  log('\nBuild Summary:', colors.bright + colors.blue);

  for (const { platform, arch, success } of results) {
    const status = success ? `${colors.green}Success${colors.reset}` : `${colors.red}Failed${colors.reset}`;
    log(`${platform}-${arch}: ${status}`);
  }

  // Check if any builds failed
  const failedBuilds = results.filter(r => !r.success);
  if (failedBuilds.length > 0) {
    log(`\n${failedBuilds.length} build(s) failed.`, colors.red);
    process.exit(1);
  }

  log('\nAll builds completed successfully!', colors.bright + colors.green);
}

// Run the main function
main().catch(error => {
  log(`Error during prebuild: ${error.message}`, colors.red);
  process.exit(1);
});
