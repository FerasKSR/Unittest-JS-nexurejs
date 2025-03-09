#!/usr/bin/env node

/**
 * TypeScript Runner for NexureJS
 *
 * This script helps run TypeScript files properly in ESM mode.
 * Usage: node run-typescript.js <file.ts>
 */

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

const file = process.argv[2];

if (!file) {
  console.error('Please provide a TypeScript file to run');
  console.error('Usage: node run-typescript.js <file.ts>');
  process.exit(1);
}

const filePath = resolve(process.cwd(), file);

if (!existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

try {
  console.log(`Running: ${file}`);

  // Use execSync to run the TypeScript file with proper ts-node setup
  execSync(
    `NODE_OPTIONS="--no-warnings --loader ts-node/esm" ` +
    `TS_NODE_PROJECT="./tsconfig.esm.json" ` +
    `TS_NODE_ESM=true ` +
    `node ${filePath}`,
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_OPTIONS: '--no-warnings --loader ts-node/esm',
        TS_NODE_PROJECT: './tsconfig.esm.json',
        TS_NODE_ESM: 'true'
      }
    }
  );
} catch (error) {
  console.error('Error running TypeScript file:');
  process.exit(1);
}
