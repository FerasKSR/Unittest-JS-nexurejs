/**
 * Streaming Example
 *
 * This example demonstrates how to use NexureJS's streaming capabilities for:
 * - Efficient file uploads
 * - Large file downloads
 * - Real-time data transformations
 * - Memory-efficient processing
 *
 * For complete API documentation, see:
 * - API Reference: ../../docs/API_REFERENCE.md
 * - Examples Guide: ../../docs/EXAMPLES.md
 */

import { Nexure, HttpMethod } from '../../src/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import os from 'node:os';

// Create temp directory for uploads
const tempDir = path.join(os.tmpdir(), 'nexure-stream-example');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Create a new Nexure application instance
const app = new Nexure({
  logger: {
    level: 'info',
    prettyPrint: true
  },
  // Enable streaming body parsing
  bodyParser: {
    streaming: true,
    streamOptions: {
      highWaterMark: 64 * 1024, // 64KB chunks
      maxSize: 100 * 1024 * 1024 // 100MB limit
    }
  }
});

// -----------------------------------
// Custom Stream Transformers
// -----------------------------------

// A stream transformer to calculate a hash for the data passing through
class HashTransform extends Transform {
  constructor(options = {}) {
    super(options);
    this.hash = crypto.createHash('sha256');
    this.totalBytes = 0;
  }

  _transform(chunk, encoding, callback) {
    // Update hash with the chunk
    this.hash.update(chunk);
    this.totalBytes += chunk.length;

    // Pass the chunk through unchanged
    this.push(chunk);
    callback();
  }

  _flush(callback) {
    // When stream is done, calculate final hash
    this.digest = this.hash.digest('hex');
    callback();
  }
}

// A stream transformer to add line numbers to text
class LineNumberTransform extends Transform {
  constructor(options = {}) {
    super(options);
    this.lineNumber = 1;
    this.buffer = '';
  }

  _transform(chunk, encoding, callback) {
    // Convert chunk to string and append to buffer
    this.buffer += chunk.toString();

    // Process complete lines
    const lines = this.buffer.split('\n');
    // Keep the last (possibly incomplete) line in the buffer
    this.buffer = lines.pop();

    // Add line numbers to complete lines
    for (const line of lines) {
      this.push(`${this.lineNumber++}: ${line}\n`);
    }

    callback();
  }

  _flush(callback) {
    // Process any remaining data in the buffer
    if (this.buffer) {
      this.push(`${this.lineNumber}: ${this.buffer}\n`);
    }
    callback();
  }
}

// A stream transformer to uppercase text
class UppercaseTransform extends Transform {
  _transform(chunk, encoding, callback) {
    this.push(chunk.toString().toUpperCase());
    callback();
  }
}

// -----------------------------------
// Upload Endpoints
// -----------------------------------

// File upload endpoint with streaming
app.route({
  path: '/api/upload',
  method: HttpMethod.POST,
  handler: async (req, res) => {
    try {
      // Get the file name from headers
      const filename = req.headers['file-name'] || `upload-${Date.now()}.dat`;
      const outputPath = path.join(tempDir, filename);

      // Create a hash transform to calculate the file hash during upload
      const hashTransform = new HashTransform();

      // Create a write stream to the output file
      const writeStream = fs.createWriteStream(outputPath);

      // Handle upload completion
      writeStream.on('finish', () => {
        // Log upload completion
        console.log(`File upload complete: ${outputPath}`);
        console.log(`Size: ${hashTransform.totalBytes} bytes`);
        console.log(`SHA-256: ${hashTransform.digest}`);
      });

      // Stream the request body through the hash transformer and into the file
      await pipeline(
        req.stream(), // Get the incoming request as a stream
        hashTransform,
        writeStream
      );

      // Return success response with file info
      res.status(200).json({
        message: 'File uploaded successfully',
        filename,
        size: hashTransform.totalBytes,
        hash: hashTransform.digest,
        path: outputPath
      });
    } catch (err) {
      console.error('Upload error:', err);
      res.status(500).json({
        error: 'Upload Failed',
        message: err.message
      });
    }
  }
});

// -----------------------------------
// Download Endpoints
// -----------------------------------

// File download endpoint with streaming
app.route({
  path: '/api/files/:filename',
  method: HttpMethod.GET,
  handler: async (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(tempDir, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: 'Not Found',
        message: `File ${filename} not found`
      });
    }

    try {
      // Get file stats
      const stats = fs.statSync(filePath);

      // Check if client wants gzip compression
      const acceptEncoding = req.headers['accept-encoding'] || '';
      const useCompression = acceptEncoding.includes('gzip');

      // Set response headers
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      if (useCompression) {
        res.setHeader('Content-Encoding', 'gzip');
      } else {
        res.setHeader('Content-Length', stats.size);
      }

      // Create read stream from file
      const readStream = fs.createReadStream(filePath);

      // Stream the file to the response
      if (useCompression) {
        // With compression
        const gzip = zlib.createGzip();
        await pipeline(readStream, gzip, res.stream());
      } else {
        // Without compression
        await pipeline(readStream, res.stream());
      }
    } catch (err) {
      console.error('Download error:', err);
      // If response headers have not been sent yet, send error response
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Download Failed',
          message: err.message
        });
      }
    }
  }
});

// Text file transformation endpoint
app.route({
  path: '/api/transform/text/:filename',
  method: HttpMethod.GET,
  handler: async (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(tempDir, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: 'Not Found',
        message: `File ${filename} not found`
      });
    }

    try {
      // Get transformation options from query parameters
      const addLineNumbers = req.query.lineNumbers === 'true';
      const uppercase = req.query.uppercase === 'true';

      // Set response headers
      res.setHeader('Content-Type', 'text/plain');

      // Create read stream from file
      const readStream = fs.createReadStream(filePath);

      // Create transformation pipeline
      let stream = readStream;

      if (uppercase) {
        const uppercaseTransform = new UppercaseTransform();
        stream = stream.pipe(uppercaseTransform);
      }

      if (addLineNumbers) {
        const lineNumberTransform = new LineNumberTransform();
        stream = stream.pipe(lineNumberTransform);
      }

      // Stream the transformed content to the response
      await pipeline(stream, res.stream());
    } catch (err) {
      console.error('Transformation error:', err);
      // If response headers have not been sent yet, send error response
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Transformation Failed',
          message: err.message
        });
      }
    }
  }
});

// -----------------------------------
// Data Generation Endpoints
// -----------------------------------

// Stream a large JSON array
app.route({
  path: '/api/generate/json',
  method: HttpMethod.GET,
  handler: async (req, res) => {
    // Get the number of items to generate
    const count = parseInt(req.query.count) || 1000;

    // Set proper content type
    res.setHeader('Content-Type', 'application/json');

    // Access the response stream
    const responseStream = res.stream();

    try {
      // Start the JSON array
      responseStream.write('[\n');

      // Write items in chunks to avoid memory issues
      for (let i = 0; i < count; i++) {
        const item = {
          id: i,
          name: `Item ${i}`,
          timestamp: Date.now(),
          data: crypto.randomBytes(20).toString('hex')
        };

        // Add commas between items, but not after the last one
        if (i > 0) {
          responseStream.write(',\n');
        }

        // Write the item to the stream
        responseStream.write(JSON.stringify(item, null, 2));

        // Simulate some processing time for larger datasets
        if (i % 100 === 0 && count > 1000) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      // End the JSON array
      responseStream.write('\n]');
      responseStream.end();
    } catch (err) {
      console.error('JSON generation error:', err);
      // If we haven't written any data yet, send error
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Generation Failed',
          message: err.message
        });
      } else {
        // Otherwise just end the stream
        responseStream.end();
      }
    }
  }
});

// Stream a large CSV file
app.route({
  path: '/api/generate/csv',
  method: HttpMethod.GET,
  handler: async (req, res) => {
    // Get the number of rows to generate
    const count = parseInt(req.query.count) || 1000;

    // Set proper content type and headers for download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="large-data.csv"');

    // Access the response stream
    const responseStream = res.stream();

    try {
      // Write CSV header
      responseStream.write('id,name,timestamp,value1,value2,value3\n');

      // Write rows in chunks to avoid memory issues
      for (let i = 0; i < count; i++) {
        const row = [
          i,
          `Item-${i}`,
          Date.now(),
          Math.random() * 1000,
          Math.random() * 100,
          Math.random() < 0.5 ? 'true' : 'false'
        ].join(',');

        // Write the row to the stream
        responseStream.write(`${row}\n`);

        // Simulate some processing time for larger datasets
        if (i % 100 === 0 && count > 1000) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      responseStream.end();
    } catch (err) {
      console.error('CSV generation error:', err);
      // If we haven't written any data yet, send error
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Generation Failed',
          message: err.message
        });
      } else {
        // Otherwise just end the stream
        responseStream.end();
      }
    }
  }
});

// -----------------------------------
// Home and Demo Routes
// -----------------------------------

// Home route with demo instructions
app.route({
  path: '/',
  method: HttpMethod.GET,
  handler: (req, res) => {
    res.status(200).json({
      message: 'Streaming API Demo',
      uploadEndpoints: {
        streamUpload: {
          method: 'POST',
          url: '/api/upload',
          description: 'Upload a file with streaming',
          example: `curl -X POST -H "file-name: example.txt" --data-binary @/path/to/file.txt http://localhost:${app.port}/api/upload`
        }
      },
      downloadEndpoints: {
        fileDownload: {
          method: 'GET',
          url: '/api/files/:filename',
          description: 'Download a previously uploaded file',
          example: `curl -O http://localhost:${app.port}/api/files/example.txt`
        },
        textTransform: {
          method: 'GET',
          url: '/api/transform/text/:filename',
          description: 'Download a transformed text file',
          options: ['lineNumbers=true', 'uppercase=true'],
          example: `curl "http://localhost:${app.port}/api/transform/text/example.txt?lineNumbers=true&uppercase=true"`
        }
      },
      generationEndpoints: {
        jsonGenerate: {
          method: 'GET',
          url: '/api/generate/json',
          description: 'Generate a large JSON array',
          options: ['count=10000'],
          example: `curl "http://localhost:${app.port}/api/generate/json?count=10000" > large.json`
        },
        csvGenerate: {
          method: 'GET',
          url: '/api/generate/csv',
          description: 'Generate a large CSV file',
          options: ['count=10000'],
          example: `curl "http://localhost:${app.port}/api/generate/csv?count=10000" > large.csv`
        }
      }
    });
  }
});

// -----------------------------------
// Create a simple demo text file
// -----------------------------------

// Create a sample text file for demo purposes
const createSampleTextFile = () => {
  const filePath = path.join(tempDir, 'sample.txt');
  const lines = [];

  // Generate some Lorem Ipsum text
  for (let i = 0; i < 100; i++) {
    lines.push(`Line ${i+1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`);
  }

  fs.writeFileSync(filePath, lines.join('\n'));
  console.log(`Created sample text file: ${filePath}`);
};

// -----------------------------------
// Start the server
// -----------------------------------
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Streaming demo server running at http://localhost:${port}`);
  createSampleTextFile();
  console.log('\nDemo commands:');

  console.log('\n1. Upload a file:');
  console.log(`curl -X POST -H "file-name: example.txt" --data-binary @${path.join(tempDir, 'sample.txt')} http://localhost:${port}/api/upload`);

  console.log('\n2. Download a file:');
  console.log(`curl -O http://localhost:${port}/api/files/sample.txt`);

  console.log('\n3. Get file with line numbers and uppercase:');
  console.log(`curl "http://localhost:${port}/api/transform/text/sample.txt?lineNumbers=true&uppercase=true"`);

  console.log('\n4. Generate large JSON (1000 items):');
  console.log(`curl "http://localhost:${port}/api/generate/json?count=1000" > large.json`);

  console.log('\n5. Generate large CSV (1000 rows):');
  console.log(`curl "http://localhost:${port}/api/generate/csv?count=1000" > large.csv`);
});
