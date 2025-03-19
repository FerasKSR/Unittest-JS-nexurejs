/**
 * Basic JavaScript Operations Benchmarks
 *
 * Tests fundamental JavaScript operations like array manipulation,
 * object operations, and string processing.
 */

import { runBenchmark } from './index.js';

// Sample data for benchmarks
const sampleArray = Array.from({ length: 1000 }, (_, i) => i);
const sampleObject = {
  name: 'test',
  value: 123,
  items: sampleArray.slice(0, 10),
  nested: {
    a: 1,
    b: 2,
    c: [1, 2, 3]
  },
  tags: ['javascript', 'benchmark', 'performance']
};
const sampleString = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';
const sampleJson = JSON.stringify(sampleObject);

/**
 * Benchmark array operations
 */
function benchmarkArrayOperations(): void {
  console.log('\n=== Array Operations ===');

  // Array.map
  runBenchmark('Array.map', 'basic', () => {
    sampleArray.map(x => x * 2);
  });

  // Array.filter
  runBenchmark('Array.filter', 'basic', () => {
    sampleArray.filter(x => x % 2 === 0);
  });

  // Array.reduce
  runBenchmark('Array.reduce', 'basic', () => {
    sampleArray.reduce((acc, val) => acc + val, 0);
  });

  // Array.forEach
  runBenchmark('Array.forEach', 'basic', () => {
    let sum = 0;
    sampleArray.forEach(x => { sum += x; });
  });

  // Array spread
  runBenchmark('Array spread', 'basic', () => {
    const newArray = [...sampleArray.slice(0, 100)];
  });
}

/**
 * Benchmark object operations
 */
function benchmarkObjectOperations(): void {
  console.log('\n=== Object Operations ===');

  // Object.keys
  runBenchmark('Object.keys', 'basic', () => {
    Object.keys(sampleObject);
  });

  // Object.values
  runBenchmark('Object.values', 'basic', () => {
    Object.values(sampleObject);
  });

  // Object.entries
  runBenchmark('Object.entries', 'basic', () => {
    Object.entries(sampleObject);
  });

  // Object spread
  runBenchmark('Object spread', 'basic', () => {
    const newObj = { ...sampleObject, newProp: 'value' };
  });

  // JSON.stringify
  runBenchmark('JSON.stringify', 'basic', () => {
    JSON.stringify(sampleObject);
  });

  // JSON.parse
  runBenchmark('JSON.parse', 'basic', () => {
    JSON.parse(sampleJson);
  });
}

/**
 * Benchmark string operations
 */
function benchmarkStringOperations(): void {
  console.log('\n=== String Operations ===');

  // String.split
  runBenchmark('String.split', 'basic', () => {
    sampleString.split(' ');
  });

  // String.replace
  runBenchmark('String.replace', 'basic', () => {
    sampleString.replace(/a/g, 'b');
  });

  // String.match
  runBenchmark('String.match', 'basic', () => {
    sampleString.match(/\w{5,}/g);
  });

  // String concatenation
  runBenchmark('String concatenation', 'basic', () => {
    let result = '';
    for (let i = 0; i < 20; i++) {
      result += sampleString.substring(0, 10);
    }
  });

  // Template literals
  runBenchmark('Template literals', 'basic', () => {
    const a = 1, b = 2, c = 3;
    const result = `${a} + ${b} = ${c}. ${sampleString.substring(0, 50)}`;
  });
}

/**
 * Run all basic benchmarks
 */
export async function runBasicBenchmarks(): Promise<void> {
  benchmarkArrayOperations();
  benchmarkObjectOperations();
  benchmarkStringOperations();
}
