#!/usr/bin/env node

/**
 * Production Bundle Generator
 *
 * This script creates an optimized production bundle with:
 * - Tree-shaking to remove unused code
 * - Minification for smaller file size
 * - Source maps for debugging
 * - Removal of development and test code
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import zlib from 'zlib';

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const prodDistDir = path.join(rootDir, 'dist-prod');

// ANSI color codes for console output
const Colors = {
  RESET: '\x1b[0m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  BOLD: '\x1b[1m'
};

/**
 * Print a section header
 */
function printSectionHeader(title) {
  console.log(`\n${Colors.CYAN}${Colors.BOLD}${title}${Colors.RESET}`);
  console.log(`${Colors.CYAN}${'='.repeat(title.length)}${Colors.RESET}`);
}

/**
 * Run a command and return its output
 */
function runCommand(command, options = {}) {
  try {
    console.log(`${Colors.DIM}> ${command}${Colors.RESET}`);
    const output = execSync(command, {
      cwd: options.cwd || rootDir,
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
    return { success: true, output };
  } catch (error) {
    console.error(`${Colors.RED}Command failed: ${command}${Colors.RESET}`);
    return {
      success: false,
      output: error.stdout || '',
      error: error.stderr || error.message
    };
  }
}

/**
 * Ensure directory exists
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Copy files with pattern matching
 */
function copyFiles(sourceDir, targetDir, pattern, exclude = []) {
  if (!fs.existsSync(sourceDir)) return;
  ensureDir(targetDir);

  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    // Skip excluded patterns
    if (exclude.some(pattern => sourcePath.includes(pattern))) {
      continue;
    }

    if (entry.isDirectory()) {
      copyFiles(sourcePath, targetPath, pattern, exclude);
    } else if (pattern.test(entry.name)) {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

/**
 * Check if esbuild is installed, install if needed
 */
async function ensureEsbuild() {
  try {
    require.resolve('esbuild');
    return true;
  } catch (error) {
    console.log(`${Colors.YELLOW}esbuild not found, installing...${Colors.RESET}`);
    const result = runCommand('npm install --no-save esbuild');
    return result.success;
  }
}

/**
 * Bundle with esbuild
 */
async function bundleWithEsbuild() {
  printSectionHeader('Creating optimized bundle with esbuild');

  // Prepare output directory
  ensureDir(prodDistDir);

  // Import esbuild dynamically
  const esbuild = await import('esbuild');

  // Bundle the main entrypoint
  try {
    const result = await esbuild.build({
      entryPoints: [path.join(distDir, 'index.js')],
      bundle: true,
      minify: true,
      sourcemap: true,
      platform: 'node',
      target: ['node16'],
      outfile: path.join(prodDistDir, 'index.js'),
      format: 'esm',
      external: [
        // External dependencies that should not be bundled
        ...Object.keys(require(path.join(rootDir, 'package.json')).dependencies || {}),
        ...Object.keys(require(path.join(rootDir, 'package.json')).optionalDependencies || {}),
        'node:*' // Node.js built-in modules
      ],
      define: {
        'process.env.NODE_ENV': '"production"'
      },
      banner: {
        js: '/* NexureJS - Production build */'
      }
    });

    console.log(`${Colors.GREEN}Bundle created successfully: ${prodDistDir}/index.js${Colors.RESET}`);
    return true;
  } catch (error) {
    console.error(`${Colors.RED}Bundling failed:${Colors.RESET}`, error);
    return false;
  }
}

/**
 * Bundle CommonJS format
 */
async function bundleCJS() {
  printSectionHeader('Creating CommonJS bundle');

  // Prepare output directory
  ensureDir(path.join(prodDistDir, 'cjs'));

  // Import esbuild dynamically
  const esbuild = await import('esbuild');

  // Bundle the CJS entrypoint
  try {
    const result = await esbuild.build({
      entryPoints: [path.join(distDir, 'cjs', 'index.js')],
      bundle: true,
      minify: true,
      sourcemap: true,
      platform: 'node',
      target: ['node16'],
      outfile: path.join(prodDistDir, 'cjs', 'index.js'),
      format: 'cjs',
      external: [
        // External dependencies that should not be bundled
        ...Object.keys(require(path.join(rootDir, 'package.json')).dependencies || {}),
        ...Object.keys(require(path.join(rootDir, 'package.json')).optionalDependencies || {}),
        'node:*' // Node.js built-in modules
      ],
      define: {
        'process.env.NODE_ENV': '"production"'
      },
      banner: {
        js: '/* NexureJS - Production build (CommonJS) */'
      }
    });

    console.log(`${Colors.GREEN}CJS bundle created successfully: ${prodDistDir}/cjs/index.js${Colors.RESET}`);
    return true;
  } catch (error) {
    console.error(`${Colors.RED}CJS bundling failed:${Colors.RESET}`, error);
    return false;
  }
}

/**
 * Copy declaration files
 */
function copyDeclarationFiles() {
  printSectionHeader('Copying TypeScript declaration files');

  // Copy all .d.ts files
  copyFiles(distDir, prodDistDir, /\.d\.ts$/, ['/test/', '.test.', '.spec.']);

  console.log(`${Colors.GREEN}Declaration files copied${Colors.RESET}`);
  return true;
}

/**
 * Create package.json for the bundle
 */
function createPackageJson() {
  printSectionHeader('Creating production package.json');

  const packageJson = require(path.join(rootDir, 'package.json'));

  // Create a minimal package.json for the bundle
  const prodPackageJson = {
    name: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
    main: 'cjs/index.js',
    module: 'index.js',
    types: 'index.d.ts',
    author: packageJson.author,
    license: packageJson.license,
    type: 'module',
    dependencies: packageJson.dependencies,
    optionalDependencies: packageJson.optionalDependencies,
    engines: packageJson.engines,
    repository: packageJson.repository,
    bugs: packageJson.bugs,
    homepage: packageJson.homepage,
    exports: packageJson.exports
  };

  // Write the production package.json
  fs.writeFileSync(
    path.join(prodDistDir, 'package.json'),
    JSON.stringify(prodPackageJson, null, 2)
  );

  console.log(`${Colors.GREEN}Production package.json created${Colors.RESET}`);
  return true;
}

/**
 * Copy additional required files
 */
function copyAdditionalFiles() {
  printSectionHeader('Copying additional files');

  // Copy README, LICENSE, etc.
  const filesToCopy = ['README.md', 'LICENSE', 'CHANGELOG.md'];

  for (const file of filesToCopy) {
    const sourcePath = path.join(rootDir, file);
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, path.join(prodDistDir, file));
      console.log(`${Colors.GREEN}Copied ${file}${Colors.RESET}`);
    }
  }

  return true;
}

/**
 * Calculate and display bundle size statistics
 */
function calculateBundleStats() {
  printSectionHeader('Bundle Size Statistics');

  const files = [
    { name: 'ESM Bundle', path: path.join(prodDistDir, 'index.js') },
    { name: 'CJS Bundle', path: path.join(prodDistDir, 'cjs', 'index.js') }
  ];

  for (const file of files) {
    if (fs.existsSync(file.path)) {
      const content = fs.readFileSync(file.path);
      const sizeKB = Math.round(content.length / 1024 * 100) / 100;

      // Calculate gzipped size
      const gzipped = zlib.gzipSync(content);
      const gzipSizeKB = Math.round(gzipped.length / 1024 * 100) / 100;

      console.log(`${Colors.BLUE}${file.name}:${Colors.RESET}`);
      console.log(`  Original: ${sizeKB} KB`);
      console.log(`  Gzipped:  ${gzipSizeKB} KB`);
    }
  }
}

/**
 * Main function
 */
async function main() {
  printSectionHeader('Creating Production Bundle');

  // Ensure esbuild is installed
  if (!await ensureEsbuild()) {
    console.error(`${Colors.RED}Failed to install esbuild. Aborting.${Colors.RESET}`);
    process.exit(1);
  }

  // Create bundles
  const esmSuccess = await bundleWithEsbuild();
  const cjsSuccess = await bundleCJS();

  if (!esmSuccess || !cjsSuccess) {
    console.error(`${Colors.RED}Bundle creation failed.${Colors.RESET}`);
    process.exit(1);
  }

  // Copy TypeScript declaration files
  copyDeclarationFiles();

  // Create package.json for the bundle
  createPackageJson();

  // Copy additional files
  copyAdditionalFiles();

  // Calculate bundle size
  calculateBundleStats();

  console.log(`\n${Colors.GREEN}${Colors.BOLD}Production bundle created successfully!${Colors.RESET}`);
  console.log(`${Colors.GREEN}Output directory: ${prodDistDir}${Colors.RESET}`);
}

// Run the script
main().catch(error => {
  console.error(`${Colors.RED}Error:${Colors.RESET}`, error);
  process.exit(1);
});
