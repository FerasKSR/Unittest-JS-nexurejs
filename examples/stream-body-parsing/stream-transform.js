/**
 * Stream Transformation Middleware Example
 *
 * This example demonstrates how to create middleware for transforming request bodies
 * using Node.js streams. This is particularly useful for processing large files or
 * request bodies without loading the entire content into memory.
 *
 * Features:
 * - Custom Transform streams for processing request data
 * - Integration with body parser middleware
 * - Streaming transformations like compression/decompression, encryption/decryption
 */

import { Nexure } from '../../dist/index.js';
import { createBodyParserMiddleware } from '../../dist/http/body-parser.js';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream, promises as fs } from 'node:fs';
import { createGzip, createGunzip } from 'node:zlib';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

const PORT = 3030;
const TEST_FILES_DIR = join(tmpdir(), 'nexure-transform-test');

// Encryption settings - in a real app, you'd use a secure key management system
const ENCRYPTION_KEY = randomBytes(32); // 256-bit key
const ENCRYPTION_IV = randomBytes(16);  // 128-bit IV for AES

/**
 * Create a middleware for transforming request bodies with a transform stream
 * @param {Function} createTransformStream Function that creates a transform stream
 * @returns {Function} Middleware function
 */
function createStreamTransformMiddleware(createTransformStream) {
  return async (req, _res, next) => {
    // Only process requests with bodies
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // Save original streams
    const originalPipe = req.pipe.bind(req);
    const originalOn = req.on.bind(req);

    // Create transform stream
    const transformStream = createTransformStream();

    // Create a passthrough stream to collect the transformed data
    const transformedBody = new Readable({ read() {} });

    // Replace the request pipe method to intercept reads
    req.pipe = (destination) => {
      return pipeline(req, transformStream, destination)
        .catch(err => {
          req.emit('error', err);
        });
    };

    // Store the original request body for later use
    req.rawBody = req;

    // Store the transformed body stream
    req.transformedBody = transformedBody;

    // Replace the on method to intercept data events
    req.on = (event, listener) => {
      if (event === 'data' || event === 'end') {
        // Pipe through the transform stream to the transformed body
        pipeline(req, transformStream, transformedBody)
          .catch(err => {
            req.emit('error', err);
          });

        // Listen on the transformed body
        return transformedBody.on(event, listener);
      }

      // Pass through for other events
      return originalOn(event, listener);
    };

    await next();

    // Restore original methods
    req.pipe = originalPipe;
    req.on = originalOn;
  };
}

/**
 * Create a compression middleware (gzip)
 */
function createCompressionMiddleware() {
  return createStreamTransformMiddleware(() => createGzip());
}

/**
 * Create a decompression middleware (gunzip)
 */
function createDecompressionMiddleware() {
  return createStreamTransformMiddleware(() => createGunzip());
}

/**
 * Create an encryption middleware (AES-256-CBC)
 */
function createEncryptionMiddleware(key = ENCRYPTION_KEY, iv = ENCRYPTION_IV) {
  return createStreamTransformMiddleware(() => {
    return createCipheriv('aes-256-cbc', key, iv);
  });
}

/**
 * Create a decryption middleware (AES-256-CBC)
 */
function createDecryptionMiddleware(key = ENCRYPTION_KEY, iv = ENCRYPTION_IV) {
  return createStreamTransformMiddleware(() => {
    return createDecipheriv('aes-256-cbc', key, iv);
  });
}

/**
 * Create a JSON transformation middleware (e.g., filter sensitive fields)
 */
function createJsonTransformMiddleware(transformFn) {
  return createStreamTransformMiddleware(() => {
    let buffer = '';

    return new Transform({
      objectMode: true,
      transform(chunk, encoding, callback) {
        try {
          buffer += chunk.toString();
          callback();
        } catch (err) {
          callback(err);
        }
      },
      flush(callback) {
        try {
          // Parse the collected JSON
          const data = JSON.parse(buffer);

          // Apply transformation
          const transformed = transformFn(data);

          // Convert back to JSON and push to output
          this.push(JSON.stringify(transformed));
          callback();
        } catch (err) {
          callback(err);
        }
      }
    });
  });
}

/**
 * Generate test files for the example
 */
async function generateTestFiles() {
  try {
    await fs.mkdir(TEST_FILES_DIR, { recursive: true });

    // Create a large file with sensitive data
    const sensitiveData = {
      username: 'user123',
      email: 'user@example.com',
      password: 'supersecretpassword',
      creditCard: '4111-1111-1111-1111',
      ssn: '123-45-6789',
      address: '123 Main St, Anytown, USA',
      profile: {
        firstName: 'John',
        lastName: 'Doe',
        age: 30,
        private: {
          notes: 'Very sensitive personal notes',
          medicalHistory: 'Confidential medical information'
        }
      },
      transactions: Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        amount: Math.random() * 1000,
        date: new Date().toISOString(),
        description: `Transaction ${i}`,
        accountNumber: `ACCT-${randomBytes(8).toString('hex')}`
      }))
    };

    const sensitiveFilePath = join(TEST_FILES_DIR, 'sensitive-data.json');
    await fs.writeFile(sensitiveFilePath, JSON.stringify(sensitiveData, null, 2));

    // Create an encrypted version of the file
    const encryptedFilePath = join(TEST_FILES_DIR, 'encrypted-data.enc');
    const cipher = createCipheriv('aes-256-cbc', ENCRYPTION_KEY, ENCRYPTION_IV);

    await pipeline(
      createReadStream(sensitiveFilePath),
      cipher,
      createWriteStream(encryptedFilePath)
    );

    // Create a compressed version of the file
    const compressedFilePath = join(TEST_FILES_DIR, 'compressed-data.gz');

    await pipeline(
      createReadStream(sensitiveFilePath),
      createGzip(),
      createWriteStream(compressedFilePath)
    );

    console.log(`Test files generated in ${TEST_FILES_DIR}`);
    console.log(`- sensitive-data.json: ${(await fs.stat(sensitiveFilePath)).size} bytes`);
    console.log(`- encrypted-data.enc: ${(await fs.stat(encryptedFilePath)).size} bytes`);
    console.log(`- compressed-data.gz: ${(await fs.stat(compressedFilePath)).size} bytes`);

    return {
      sensitiveFilePath,
      encryptedFilePath,
      compressedFilePath
    };
  } catch (error) {
    console.error('Error generating test files:', error);
    process.exit(1);
  }
}

/**
 * Start the server
 */
async function startServer() {
  const app = new Nexure();

  // Create body parser middleware
  const bodyParser = createBodyParserMiddleware({
    maxBufferSize: 1024 * 1024 // 1MB
  });

  // Create transformation middlewares
  const compression = createCompressionMiddleware();
  const decompression = createDecompressionMiddleware();
  const encryption = createEncryptionMiddleware();
  const decryption = createDecryptionMiddleware();

  // Create JSON transformation middleware to filter sensitive fields
  const filterSensitiveFields = createJsonTransformMiddleware(data => {
    const sanitize = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;

      const result = Array.isArray(obj) ? [] : {};

      for (const key in obj) {
        // Skip sensitive fields
        if (['password', 'creditCard', 'ssn', 'medicalHistory'].includes(key)) {
          result[key] = '*** REDACTED ***';
        }
        // Recursively sanitize nested objects
        else if (typeof obj[key] === 'object' && obj[key] !== null) {
          result[key] = sanitize(obj[key]);
        }
        // Keep non-sensitive fields as is
        else {
          result[key] = obj[key];
        }
      }

      return result;
    };

    return sanitize(data);
  });

  // Standard JSON endpoint
  app.post('/api/data', bodyParser, async (req, res) => {
    res.json({
      success: true,
      message: 'Data received (standard processing)',
      size: JSON.stringify(req.body).length,
      data: req.body
    });
  });

  // Endpoint with sensitive data filtering
  app.post('/api/filtered-data', filterSensitiveFields, bodyParser, async (req, res) => {
    res.json({
      success: true,
      message: 'Data received and filtered',
      size: JSON.stringify(req.body).length,
      data: req.body
    });
  });

  // Endpoint for compressed data
  app.post('/api/compressed-data', decompression, bodyParser, async (req, res) => {
    res.json({
      success: true,
      message: 'Compressed data received and decompressed',
      size: JSON.stringify(req.body).length,
      data: req.body
    });
  });

  // Endpoint for encrypted data
  app.post('/api/encrypted-data', decryption, bodyParser, async (req, res) => {
    res.json({
      success: true,
      message: 'Encrypted data received and decrypted',
      size: JSON.stringify(req.body).length,
      data: req.body
    });
  });

  // Response compression endpoint
  app.post('/api/compress-response', bodyParser, async (req, res) => {
    res.setHeader('Content-Encoding', 'gzip');

    // Create a gzip stream
    const gzip = createGzip();

    // Set appropriate headers
    res.setHeader('Content-Type', 'application/json');

    // Pipe the response through the gzip stream
    const responseData = {
      success: true,
      message: 'Response compressed with gzip',
      size: JSON.stringify(req.body).length,
      data: req.body
    };

    // Stream the response
    Readable.from(JSON.stringify(responseData))
      .pipe(gzip)
      .pipe(res);
  });

  // Start the server
  await app.listen(PORT);
  console.log(`Server listening on http://localhost:${PORT}`);
}

/**
 * Run the example
 */
async function runExample() {
  // Generate test files
  const { sensitiveFilePath, encryptedFilePath, compressedFilePath } = await generateTestFiles();

  // Start the server
  await startServer();

  // Test the endpoints
  console.log('\nSending sensitive data to standard endpoint...');
  const sensitiveData = await fs.readFile(sensitiveFilePath, 'utf8');
  const standardResponse = await fetch(`http://localhost:${PORT}/api/data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: sensitiveData
  });

  console.log('Standard response:', await standardResponse.json());

  console.log('\nSending sensitive data to filtered endpoint...');
  const filteredResponse = await fetch(`http://localhost:${PORT}/api/filtered-data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: sensitiveData
  });

  console.log('Filtered response:', await filteredResponse.json());

  console.log('\nSending compressed data to decompression endpoint...');
  const compressedResponse = await fetch(`http://localhost:${PORT}/api/compressed-data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Encoding': 'gzip'
    },
    body: createReadStream(compressedFilePath)
  });

  console.log('Decompression response:', await compressedResponse.json());

  console.log('\nSending encrypted data to decryption endpoint...');
  const encryptedResponse = await fetch(`http://localhost:${PORT}/api/encrypted-data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Encryption-Type': 'aes-256-cbc'
    },
    body: createReadStream(encryptedFilePath)
  });

  console.log('Decryption response:', await encryptedResponse.json());

  console.log('\nTesting response compression...');
  const compressResponseReq = await fetch(`http://localhost:${PORT}/api/compress-response`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Encoding': 'gzip'
    },
    body: sensitiveData
  });

  console.log('Compressed response received with status:', compressResponseReq.status);
  console.log('Content-Encoding header:', compressResponseReq.headers.get('Content-Encoding'));

  // To see the decompressed response, we rely on fetch's automatic decompression
  console.log('Decompressed response content:', await compressResponseReq.json());
}

runExample().catch(console.error);
