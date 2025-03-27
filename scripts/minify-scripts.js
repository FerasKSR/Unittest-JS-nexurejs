#!/usr/bin/env node

/**
 * Script Optimizer
 *
 * This script minifies and optimizes JavaScript files in the scripts folder.
 * It preserves comments, removes unused code, and optimizes performance.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SCRIPTS_DIR = __dirname;
const DIST_DIR = path.join(__dirname, '../dist/scripts');
const SKIP_FILES = ['minify-scripts.js']; // Skip this file
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

// Ensure dist directory exists
if (!fs.existsSync(DIST_DIR) && !DRY_RUN) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

/**
 * Check if dependencies are installed, install if missing
 */
function checkDependencies() {
  try {
    console.log('Checking required dependencies...');
    // Check for terser and typescript
    execSync('npm list terser typescript --depth=0', { stdio: 'ignore' });
    return true;
  } catch (error) {
    console.log('Installing required dependencies...');
    try {
      execSync('npm install --no-save terser typescript', { stdio: 'inherit' });
      return true;
    } catch (installError) {
      console.error('Failed to install dependencies:', installError.message);
      return false;
    }
  }
}

/**
 * Compile TypeScript files
 */
function compileTypeScript() {
  const tsFiles = [];

  // Find all TypeScript files
  fs.readdirSync(SCRIPTS_DIR).forEach(file => {
    if (file.endsWith('.ts') && !SKIP_FILES.includes(file)) {
      tsFiles.push(path.join(SCRIPTS_DIR, file));
    }
  });

  if (tsFiles.length === 0) {
    console.log('No TypeScript files found to compile.');
    return true;
  }

  console.log(`Compiling ${tsFiles.length} TypeScript files...`);

  try {
    if (!DRY_RUN) {
      // Create a temporary tsconfig.json file
      const tsconfig = {
        compilerOptions: {
          target: "ES2020",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          esModuleInterop: true,
          outDir: DIST_DIR,
          strict: true,
          skipLibCheck: true
        },
        include: tsFiles
      };

      const tsconfigPath = path.join(SCRIPTS_DIR, 'temp-tsconfig.json');
      fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));

      // Run the TypeScript compiler
      execSync(`npx tsc -p ${tsconfigPath}`, { stdio: 'inherit' });

      // Remove the temporary tsconfig
      fs.unlinkSync(tsconfigPath);

      console.log('TypeScript compilation complete.');
    } else {
      console.log('Dry run: Would compile TypeScript files');
    }
    return true;
  } catch (error) {
    console.error('Failed to compile TypeScript:', error.message);
    return false;
  }
}

/**
 * Minify JavaScript files
 */
async function minifyJavaScript() {
  const { minify } = await import('terser');

  const jsFiles = [];

  // Find all JavaScript files
  fs.readdirSync(SCRIPTS_DIR).forEach(file => {
    if (file.endsWith('.js') && !SKIP_FILES.includes(file)) {
      jsFiles.push(file);
    }
  });

  if (jsFiles.length === 0) {
    console.log('No JavaScript files found to minify.');
    return;
  }

  console.log(`Minifying ${jsFiles.length} JavaScript files...`);

  for (const file of jsFiles) {
    const filePath = path.join(SCRIPTS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');

    // Extract shebang and preserve it
    let shebang = '';
    const shebangMatch = content.match(/^(#!.*)$/m);
    if (shebangMatch) {
      shebang = shebangMatch[1] + '\n';
    }

    try {
      const result = await minify(content, {
        keep_classnames: true,
        keep_fnames: true,
        module: true,
        compress: {
          ecma: 2020,
          toplevel: true,
          passes: 2,
          unused: true,
          dead_code: true
        },
        mangle: {
          keep_classnames: true,
          keep_fnames: true,
        },
        output: {
          comments: 'some',  // Keep comments that include license, copyright, etc.
          ecma: 2020
        }
      });

      if (result.code) {
        const outputPath = path.join(DIST_DIR, file);
        if (!DRY_RUN) {
          // Add back the shebang if it existed
          fs.writeFileSync(outputPath, shebang + result.code);
          console.log(`Minified ${file} -> ${outputPath}`);

          // Make the file executable
          try {
            fs.chmodSync(outputPath, '755');
          } catch (err) {
            console.warn(`Warning: Could not make ${outputPath} executable`);
          }
        } else {
          console.log(`Dry run: Would minify ${file}`);
          if (VERBOSE) {
            console.log(`Original size: ${content.length} bytes`);
            console.log(`Minified size: ${result.code.length} bytes`);
            console.log(`Reduction: ${Math.round((1 - result.code.length / content.length) * 100)}%`);
          }
        }
      }
    } catch (error) {
      console.error(`Error minifying ${file}:`, error.message);
    }
  }
}

/**
 * Create optimized package.json for dist
 */
function createPackageJson() {
  if (DRY_RUN) {
    console.log('Dry run: Would create optimized package.json');
    return;
  }

  const packageJson = {
    "name": "nexurejs-scripts",
    "private": true,
    "type": "module",
    "description": "Optimized scripts for NexureJS",
    "engines": {
      "node": ">=18.0.0"
    }
  };

  fs.writeFileSync(
    path.join(DIST_DIR, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  console.log('Created optimized package.json');
}

/**
 * Main execution
 */
async function main() {
  console.log('Starting script optimization...');

  if (!checkDependencies()) {
    process.exit(1);
  }

  // Temporarily skip TypeScript compilation due to import issues
  console.log('Skipping TypeScript compilation for now...');
  // if (!compileTypeScript()) {
  //   process.exit(1);
  // }

  await minifyJavaScript();

  createPackageJson();

  console.log('Script optimization complete!');
}

main().catch(error => {
  console.error('Optimization failed:', error);
  process.exit(1);
});
