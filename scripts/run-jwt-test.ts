/**
 * Run JWT Authentication Tests and Example Server
 *
 * This script runs the JWT authentication tests and then starts the example server.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createServer } from 'node:http';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

// Print header
console.log(`${colors.bright}${colors.blue}=== NexureJS JWT Authentication Test Runner ===${colors.reset}\n`);

// Run tests
console.log(`${colors.yellow}Running JWT authentication tests...${colors.reset}`);

const testProcess = spawn('node', ['--loader', 'ts-node/esm', join(rootDir, 'tests/jwt-auth.test.ts')], {
  stdio: 'inherit'
});

testProcess.on('close', (code) => {
  if (code !== 0) {
    console.error(`${colors.red}Tests failed with code ${code}${colors.reset}`);
    process.exit(code || 1);
  }

  console.log(`\n${colors.green}${colors.bright}Tests completed successfully!${colors.reset}\n`);

  // Start example server
  console.log(`${colors.yellow}Starting JWT authentication example server...${colors.reset}`);

  const serverProcess = spawn('node', ['--loader', 'ts-node/esm', join(rootDir, 'examples/jwt-auth-example.ts')], {
    stdio: 'inherit'
  });

  serverProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`${colors.red}Server exited with code ${code}${colors.reset}`);
      process.exit(code || 1);
    }
  });

  // Check if server is running by making a request to it
  setTimeout(() => {
    console.log(`${colors.cyan}Checking if server is running...${colors.reset}`);

    const req = createServer((req, res) => {
      res.writeHead(200);
      res.end('OK');
    });

    req.on('error', (err) => {
      if (err.message.includes('ECONNREFUSED')) {
        console.error(`${colors.red}Server is not running. Connection refused.${colors.reset}`);
        serverProcess.kill();
        process.exit(1);
      }
    });

    const testReq = createServer((req, res) => {
      res.writeHead(200);
      res.end('OK');
    }).listen(0);

    testReq.close(() => {
      const http = require('http');
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/',
        method: 'GET'
      };

      const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          console.log(`${colors.green}Server is running!${colors.reset}`);
          console.log(`${colors.cyan}Response: ${colors.reset}${data.substring(0, 100)}...`);
          console.log(`\n${colors.bright}${colors.green}✓ JWT Authentication is working correctly!${colors.reset}`);
          console.log(`\n${colors.yellow}Server is running at http://localhost:3000${colors.reset}`);
          console.log(`${colors.dim}Press Ctrl+C to stop the server${colors.reset}`);
        });
      });

      req.on('error', (error) => {
        console.error(`${colors.red}Error connecting to server: ${error.message}${colors.reset}`);
        serverProcess.kill();
        process.exit(1);
      });

      req.end();
    });
  }, 2000);
});
