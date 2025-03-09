/**
 * JSON Serialization Performance Benchmark for NexureJS
 *
 * This benchmark tests the performance of the streaming JSON serializer/deserializer
 * compared to standard JSON.stringify/JSON.parse.
 */

import { Benchmark, BenchmarkSuite } from '../src/utils/performance-benchmark.js';
import { JsonSerializer, JsonParser } from '../src/serialization/streaming-json.js';
import { v8Optimizer } from '../src/utils/v8-optimizer.js';
import { Readable, Writable } from 'node:stream';

// Create test data of various sizes
function createTestData(size: 'small' | 'medium' | 'large'): any {
  // Small object (~ 100 bytes)
  if (size === 'small') {
    return {
      id: 1,
      name: 'John Doe',
      email: 'john.doe@example.com',
      active: true
    };
  }

  // Medium object (~ 5KB)
  if (size === 'medium') {
    const result: any = {
      id: 12345,
      name: 'Medium Size Object',
      items: [],
      metadata: {
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5']
      }
    };

    // Add 100 items
    for (let i = 0; i < 100; i++) {
      result.items.push({
        id: i,
        name: `Item ${i}`,
        value: Math.random() * 1000,
        active: i % 2 === 0
      });
    }

    return result;
  }

  // Large object (~ 1MB)
  const result: any = {
    id: 9876543210,
    name: 'Large Size Object',
    description: 'This is a large object used for benchmarking JSON serialization performance',
    timestamp: new Date().toISOString(),
    records: [],
    metadata: {
      version: '1.0.0',
      generated: new Date().toISOString(),
      source: 'benchmark',
      tags: Array.from({ length: 50 }, (_, i) => `tag-${i}`),
      settings: {}
    }
  };

  // Add some settings
  for (let i = 0; i < 100; i++) {
    result.metadata.settings[`setting-${i}`] = `value-${i}`;
  }

  // Add 2000 records
  for (let i = 0; i < 2000; i++) {
    const record: any = {
      id: i,
      guid: `guid-${i}-${Math.random().toString(36).substring(2, 15)}`,
      isActive: i % 2 === 0,
      balance: `$${(Math.random() * 10000).toFixed(2)}`,
      picture: `https://example.com/pictures/${i}.jpg`,
      age: 20 + Math.floor(Math.random() * 50),
      name: {
        first: `FirstName${i}`,
        last: `LastName${i}`
      },
      company: `Company ${i % 100}`,
      email: `person${i}@example.com`,
      phone: `+1 (${Math.floor(Math.random() * 1000)}) ${Math.floor(Math.random() * 1000)}-${Math.floor(Math.random() * 10000)}`,
      address: {
        street: `${Math.floor(Math.random() * 10000)} Main Street`,
        city: `City ${i % 100}`,
        state: `State ${i % 50}`,
        zipcode: `${Math.floor(Math.random() * 100000)}`
      },
      tags: Array.from({ length: 5 }, (_, j) => `tag-${i}-${j}`),
      friends: Array.from({ length: 3 }, (_, j) => ({
        id: j,
        name: `Friend ${j} of ${i}`
      }))
    };

    result.records.push(record);
  }

  return result;
}

// Create a writable stream that discards data
class NullWritable extends Writable {
  _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    callback();
  }
}

// Create a readable stream from a string
function createReadableFromString(str: string): Readable {
  return new Readable({
    read() {
      this.push(str);
      this.push(null);
    }
  });
}

// Run the benchmarks
async function runBenchmarks() {
  console.log('Starting JSON Serialization Performance Benchmarks');

  // Create test data
  const smallData = createTestData('small');
  const mediumData = createTestData('medium');
  const largeData = createTestData('large');

  // Pre-stringify the data for parse benchmarks
  const smallJson = JSON.stringify(smallData);
  const mediumJson = JSON.stringify(mediumData);
  const largeJson = JSON.stringify(largeData);

  // 1. Serialization Benchmarks
  const serializeSuite = new BenchmarkSuite({
    name: 'JSON Serialization',
    description: 'Comparing JSON serialization methods',
    baseOptions: {
      iterations: 1000,
      warmup: 100,
      collectMemoryStats: true,
      optimize: true
    }
  });

  // Add standard JSON.stringify benchmarks
  serializeSuite.add(() => {
    JSON.stringify(smallData);
  }, {
    name: 'JSON.stringify (Small)',
    description: 'Standard JSON.stringify with small object'
  });

  serializeSuite.add(() => {
    JSON.stringify(mediumData);
  }, {
    name: 'JSON.stringify (Medium)',
    description: 'Standard JSON.stringify with medium object'
  });

  serializeSuite.add(() => {
    JSON.stringify(largeData);
  }, {
    name: 'JSON.stringify (Large)',
    description: 'Standard JSON.stringify with large object',
    iterations: 100 // Fewer iterations for large data
  });

  // Add streaming serializer benchmarks
  serializeSuite.add(() => {
    const serializer = new JsonSerializer();
    const nullStream = new NullWritable();
    serializer.pipe(nullStream);
    serializer.write(smallData);
    serializer.end();
    return new Promise<void>(resolve => {
      nullStream.on('finish', resolve);
    });
  }, {
    name: 'StreamingJSON (Small)',
    description: 'Streaming JSON serializer with small object'
  });

  serializeSuite.add(() => {
    const serializer = new JsonSerializer();
    const nullStream = new NullWritable();
    serializer.pipe(nullStream);
    serializer.write(mediumData);
    serializer.end();
    return new Promise<void>(resolve => {
      nullStream.on('finish', resolve);
    });
  }, {
    name: 'StreamingJSON (Medium)',
    description: 'Streaming JSON serializer with medium object'
  });

  serializeSuite.add(() => {
    const serializer = new JsonSerializer();
    const nullStream = new NullWritable();
    serializer.pipe(nullStream);
    serializer.write(largeData);
    serializer.end();
    return new Promise<void>(resolve => {
      nullStream.on('finish', resolve);
    });
  }, {
    name: 'StreamingJSON (Large)',
    description: 'Streaming JSON serializer with large object',
    iterations: 100 // Fewer iterations for large data
  });

  // Run serialization benchmarks
  const serializeResults = await serializeSuite.run();
  console.log(serializeSuite.compareResults('JSON.stringify (Small)', 'StreamingJSON (Small)', serializeResults));
  console.log(serializeSuite.compareResults('JSON.stringify (Medium)', 'StreamingJSON (Medium)', serializeResults));
  console.log(serializeSuite.compareResults('JSON.stringify (Large)', 'StreamingJSON (Large)', serializeResults));
  serializeSuite.saveResults(serializeResults);

  // 2. Deserialization Benchmarks
  const deserializeSuite = new BenchmarkSuite({
    name: 'JSON Deserialization',
    description: 'Comparing JSON deserialization methods',
    baseOptions: {
      iterations: 1000,
      warmup: 100,
      collectMemoryStats: true,
      optimize: true
    }
  });

  // Add standard JSON.parse benchmarks
  deserializeSuite.add(() => {
    JSON.parse(smallJson);
  }, {
    name: 'JSON.parse (Small)',
    description: 'Standard JSON.parse with small object'
  });

  deserializeSuite.add(() => {
    JSON.parse(mediumJson);
  }, {
    name: 'JSON.parse (Medium)',
    description: 'Standard JSON.parse with medium object'
  });

  deserializeSuite.add(() => {
    JSON.parse(largeJson);
  }, {
    name: 'JSON.parse (Large)',
    description: 'Standard JSON.parse with large object',
    iterations: 100 // Fewer iterations for large data
  });

  // Add streaming parser benchmarks
  deserializeSuite.add(() => {
    const parser = new JsonParser();
    const readable = createReadableFromString(smallJson);
    readable.pipe(parser);

    return new Promise<void>(resolve => {
      parser.on('data', () => {});
      parser.on('end', resolve);
    });
  }, {
    name: 'StreamingJSON.parse (Small)',
    description: 'Streaming JSON parser with small object'
  });

  deserializeSuite.add(() => {
    const parser = new JsonParser();
    const readable = createReadableFromString(mediumJson);
    readable.pipe(parser);

    return new Promise<void>(resolve => {
      parser.on('data', () => {});
      parser.on('end', resolve);
    });
  }, {
    name: 'StreamingJSON.parse (Medium)',
    description: 'Streaming JSON parser with medium object'
  });

  deserializeSuite.add(() => {
    const parser = new JsonParser();
    const readable = createReadableFromString(largeJson);
    readable.pipe(parser);

    return new Promise<void>(resolve => {
      parser.on('data', () => {});
      parser.on('end', resolve);
    });
  }, {
    name: 'StreamingJSON.parse (Large)',
    description: 'Streaming JSON parser with large object',
    iterations: 100 // Fewer iterations for large data
  });

  // Run deserialization benchmarks
  const deserializeResults = await deserializeSuite.run();
  console.log(deserializeSuite.compareResults('JSON.parse (Small)', 'StreamingJSON.parse (Small)', deserializeResults));
  console.log(deserializeSuite.compareResults('JSON.parse (Medium)', 'StreamingJSON.parse (Medium)', deserializeResults));
  console.log(deserializeSuite.compareResults('JSON.parse (Large)', 'StreamingJSON.parse (Large)', deserializeResults));
  deserializeSuite.saveResults(deserializeResults);
}

// Run the benchmarks
runBenchmarks().catch(err => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
