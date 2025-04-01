/**
 * Stream Body Parsing Example
 *
 * This example demonstrates how to use the streaming body parser middleware
 * with configurable thresholds for handling large request bodies efficiently.
 *
 * Features:
 * - Configurable memory threshold for streaming vs buffering
 * - Temporary file storage for large request bodies
 * - Automatic cleanup of temporary files
 * - Support for various content types (JSON, form data, text)
 */

import { Nexure } from '../../dist/index.js';
import { createBodyParserMiddleware } from '../../dist/http/body-parser.js';
import { createReadStream, promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

const PORT = 3000;
const TEST_FILES_DIR = join(tmpdir(), 'nexure-test-files');

/**
 * Generate test files of various sizes for testing stream processing
 */
async function generateTestFiles() {
  try {
    await fs.mkdir(TEST_FILES_DIR, { recursive: true });

    // Small JSON file (under the default threshold)
    const smallData = {
      name: 'Small JSON',
      description: 'This is a small JSON file that will be processed in memory',
      items: Array.from({ length: 10 }, (_, i) => ({ id: i, value: `Item ${i}` }))
    };

    const smallPath = join(TEST_FILES_DIR, 'small.json');
    await fs.writeFile(smallPath, JSON.stringify(smallData, null, 2));

    // Medium JSON file (around the default threshold)
    const mediumData = {
      name: 'Medium JSON',
      description: 'This is a medium-sized JSON file that may be streamed depending on configuration',
      items: Array.from({ length: 5000 }, (_, i) => ({ id: i, value: `Item ${i}`, data: randomBytes(100).toString('hex') }))
    };

    const mediumPath = join(TEST_FILES_DIR, 'medium.json');
    await fs.writeFile(mediumPath, JSON.stringify(mediumData, null, 2));

    // Large JSON file (above the default threshold)
    const largePath = join(TEST_FILES_DIR, 'large.json');
    const largeStream = fs.createWriteStream(largePath);

    largeStream.write('{\n');
    largeStream.write('  "name": "Large JSON",\n');
    largeStream.write('  "description": "This is a large JSON file that will be streamed to a temporary file",\n');
    largeStream.write('  "items": [\n');

    for (let i = 0; i < 50000; i++) {
      const item = {
        id: i,
        value: `Item ${i}`,
        data: randomBytes(200).toString('hex')
      };

      largeStream.write(i === 0 ? '    ' : ',\n    ');
      largeStream.write(JSON.stringify(item));
    }

    largeStream.write('\n  ]\n}\n');
    largeStream.end();

    await new Promise(resolve => largeStream.on('finish', resolve));

    console.log(`Test files generated in ${TEST_FILES_DIR}`);
    console.log(`- small.json: ${(await fs.stat(smallPath)).size} bytes`);
    console.log(`- medium.json: ${(await fs.stat(mediumPath)).size} bytes`);
    console.log(`- large.json: ${(await fs.stat(largePath)).size} bytes`);

    return {
      smallPath,
      mediumPath,
      largePath
    };
  } catch (error) {
    console.error('Error generating test files:', error);
    process.exit(1);
  }
}

/**
 * Create a test client for sending requests of various sizes
 */
async function createTestClient() {
  const { smallPath, mediumPath, largePath } = await generateTestFiles();

  return {
    async sendSmallRequest() {
      const data = await fs.readFile(smallPath, 'utf8');
      return fetch(`http://localhost:${PORT}/api/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: data
      });
    },

    async sendMediumRequest() {
      const data = await fs.readFile(mediumPath, 'utf8');
      return fetch(`http://localhost:${PORT}/api/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: data
      });
    },

    async sendLargeRequest() {
      return fetch(`http://localhost:${PORT}/api/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: createReadStream(largePath)
      });
    }
  };
}

/**
 * Start the server
 */
async function startServer() {
  const app = new Nexure();

  // Create body parser middleware with different configurations

  // Standard config - stream requests larger than 1MB
  const standardBodyParser = createBodyParserMiddleware();

  // Small threshold - stream requests larger than 100KB
  const lowThresholdBodyParser = createBodyParserMiddleware({
    maxBufferSize: 100 * 1024, // 100KB
    tempDir: join(tmpdir(), 'nexure-low-threshold')
  });

  // Large threshold - stream requests larger than 5MB
  const highThresholdBodyParser = createBodyParserMiddleware({
    maxBufferSize: 5 * 1024 * 1024, // 5MB
    tempDir: join(tmpdir(), 'nexure-high-threshold')
  });

  // Define routes

  // Default threshold (1MB)
  app.post('/api/process', standardBodyParser, async (req, res) => {
    const body = req.body;
    const size = JSON.stringify(body).length;

    res.json({
      success: true,
      message: 'Processed with standard threshold (1MB)',
      size,
      itemCount: body.items?.length || 0
    });
  });

  // Low threshold (100KB)
  app.post('/api/process/low-threshold', lowThresholdBodyParser, async (req, res) => {
    const body = req.body;
    const size = JSON.stringify(body).length;

    res.json({
      success: true,
      message: 'Processed with low threshold (100KB)',
      size,
      itemCount: body.items?.length || 0
    });
  });

  // High threshold (5MB)
  app.post('/api/process/high-threshold', highThresholdBodyParser, async (req, res) => {
    const body = req.body;
    const size = JSON.stringify(body).length;

    res.json({
      success: true,
      message: 'Processed with high threshold (5MB)',
      size,
      itemCount: body.items?.length || 0
    });
  });

  // Start the server
  await app.listen(PORT);
  console.log(`Server listening on http://localhost:${PORT}`);
}

/**
 * Run the example
 */
async function runExample() {
  // Start the server
  await startServer();

  // Create test client
  const client = await createTestClient();

  console.log('\nSending small request...');
  const smallResponse = await client.sendSmallRequest();
  console.log('Small request response:', await smallResponse.json());

  console.log('\nSending medium request...');
  const mediumResponse = await client.sendMediumRequest();
  console.log('Medium request response:', await mediumResponse.json());

  console.log('\nSending large request...');
  const largeResponse = await client.sendLargeRequest();
  console.log('Large request response:', await largeResponse.json());

  console.log('\nTesting different thresholds...');

  console.log('\nSending medium request to low threshold endpoint...');
  const lowThresholdResponse = await fetch(`http://localhost:${PORT}/api/process/low-threshold`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: await client.sendMediumRequest().then(res => res.text())
  });
  console.log('Low threshold response:', await lowThresholdResponse.json());

  console.log('\nSending large request to high threshold endpoint...');
  const highThresholdResponse = await fetch(`http://localhost:${PORT}/api/process/high-threshold`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: createReadStream((await generateTestFiles()).largePath)
  });
  console.log('High threshold response:', await highThresholdResponse.json());
}

runExample().catch(console.error);
