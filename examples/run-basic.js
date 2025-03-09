// This file is used to run the basic example
import { spawn } from 'child_process';

const child = spawn('node', [
  '--loader', 'ts-node/esm',
  '--experimental-specifier-resolution=node',
  'examples/basic/index.ts'
], {
  stdio: 'inherit',
  env: {
    ...process.env,
    TS_NODE_PROJECT: 'tsconfig.json',
    TS_NODE_TRANSPILE_ONLY: 'true'
  }
});

child.on('close', (code) => {
  process.exit(code);
});
