/**
 * Data Generators for Performance Testing
 *
 * This module provides functions to generate test data of various types and sizes
 * for benchmarking and profiling the Nexure.js framework.
 */

import { randomBytes } from 'node:crypto';
import crypto from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Generate text data with the specified number of lines and line length
 * @param {number} numLines - Number of lines to generate
 * @param {number} lineLength - Average length of each line
 * @returns {string} Generated text
 */
export function generateTextData(numLines = 100, lineLength = 80) {
  let text = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ,.;:\'"!@#$%^&*()_+-=[]{}|\\';

  for (let i = 0; i < numLines; i++) {
    let line = `Line ${i + 1}: `;

    for (let j = line.length; j < lineLength; j++) {
      line += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    text += line + '\n';
  }

  return text;
}

/**
 * Generate JSON data with the specified number of records and fields
 * @param {number} numRecords - Number of records to generate
 * @param {number} numFields - Number of fields per record
 * @returns {Array} Array of generated objects
 */
export function generateJsonData(numRecords = 100, numFields = 10) {
  const result = [];

  for (let i = 0; i < numRecords; i++) {
    const record = {
      id: i,
      name: `Record ${i}`,
      timestamp: Date.now()
    };

    // Add random fields
    for (let f = 0; f < numFields; f++) {
      record[`field${f}`] = Math.random() < 0.5
        ? Math.random() * 1000
        : `Value ${f}-${Math.floor(Math.random() * 1000)}`;
    }

    result.push(record);
  }

  return result;
}

/**
 * Generate CSV data with the specified number of rows and columns
 * @param {number} numRows - Number of rows to generate
 * @param {number} numColumns - Number of columns per row
 * @returns {string} Generated CSV string
 */
export function generateCsvData(numRows = 100, numColumns = 10) {
  let csv = '';

  // Generate header
  const header = ['id', 'name', 'timestamp'];
  for (let c = 0; c < numColumns - 3; c++) {
    header.push(`field${c}`);
  }
  csv += header.join(',') + '\n';

  // Generate rows
  for (let i = 0; i < numRows; i++) {
    const row = [
      i,
      `Record ${i}`,
      Date.now()
    ];

    // Add random fields
    for (let c = 0; c < numColumns - 3; c++) {
      row.push(Math.random() < 0.5
        ? Math.round(Math.random() * 1000)
        : `Value ${c}-${Math.floor(Math.random() * 1000)}`);
    }

    csv += row.join(',') + '\n';
  }

  return csv;
}

/**
 * Generate a deeply nested object for testing complex object processing
 * @param {number} depth - Maximum depth of the object tree
 * @param {number} breadth - Number of children at each level
 * @returns {Object} A deeply nested object
 */
export function generateNestedObject(depth = 5, breadth = 3) {
  function createLevel(currentDepth) {
    if (currentDepth <= 0) {
      return {
        value: Math.random() * 100,
        id: `leaf-${Math.floor(Math.random() * 10000)}`,
        name: `Leaf ${Math.floor(Math.random() * 100)}`
      };
    }

    const obj = {
      id: `level-${currentDepth}-${Math.floor(Math.random() * 1000)}`,
      name: `Level ${currentDepth}`,
      timestamp: Date.now()
    };

    // Add children
    obj.children = [];
    for (let i = 0; i < breadth; i++) {
      obj.children.push(createLevel(currentDepth - 1));
    }

    // Add some properties
    for (let i = 0; i < breadth; i++) {
      obj[`prop${i}`] = `Property ${i} at level ${currentDepth}`;
    }

    return obj;
  }

  return createLevel(depth);
}

/**
 * Generate a large binary buffer of random data
 * @param {number} sizeInBytes - Size of the buffer in bytes
 * @returns {Buffer} Random binary data
 */
export function generateRandomBinaryBuffer(sizeInBytes = 1024 * 1024) {
  return randomBytes(sizeInBytes);
}

/**
 * Generate a large array of numbers for numeric processing tests
 * @param {number} length - Length of the array
 * @returns {Array<number>} Array of random numbers
 */
export function generateNumberArray(length = 10000) {
  return Array.from({ length }, () => Math.random() * 1000);
}

// Export a helper to create various sized test data sets
export function createTestDataSet(size = 'medium') {
  const sizes = {
    tiny: {
      text: { lines: 10, length: 40 },
      json: { records: 10, fields: 5 },
      csv: { rows: 10, columns: 5 },
      nested: { depth: 3, breadth: 2 }
    },
    small: {
      text: { lines: 100, length: 80 },
      json: { records: 100, fields: 10 },
      csv: { rows: 100, columns: 10 },
      nested: { depth: 4, breadth: 3 }
    },
    medium: {
      text: { lines: 1000, length: 100 },
      json: { records: 1000, fields: 15 },
      csv: { rows: 1000, columns: 15 },
      nested: { depth: 5, breadth: 4 }
    },
    large: {
      text: { lines: 10000, length: 120 },
      json: { records: 10000, fields: 20 },
      csv: { rows: 10000, columns: 20 },
      nested: { depth: 7, breadth: 5 }
    },
    huge: {
      text: { lines: 100000, length: 150 },
      json: { records: 50000, fields: 25 },
      csv: { rows: 50000, columns: 25 },
      nested: { depth: 8, breadth: 6 }
    }
  };

  const config = sizes[size] || sizes.medium;

  return {
    text: generateTextData(config.text.lines, config.text.length),
    json: generateJsonData(config.json.records, config.json.fields),
    csv: generateCsvData(config.csv.rows, config.csv.columns),
    nested: generateNestedObject(config.nested.depth, config.nested.breadth)
  };
}

/**
 * Benchmark Data Generators
 *
 * Utilities for generating test data for the benchmarks.
 */

// Default test data directory
const TEST_DATA_DIR = join(process.cwd(), 'test-data');

// Ensure test data directory exists
try {
  if (!existsSync(TEST_DATA_DIR)) {
    mkdirSync(TEST_DATA_DIR, { recursive: true });
  }
} catch (err) {
  console.error('Error creating test data directory:', err instanceof Error ? err.message : String(err));
}

/**
 * Generate a random string of specified length
 */
function generateRandomString(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

/**
 * Generate a random record with specified properties
 */
function generateRandomRecord(keyCount, stringLength, depth, withArrays, withNestedObjects) {
  const record = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    active: Math.random() > 0.5
  };

  // Add random properties
  for (let i = 0; i < keyCount; i++) {
    const key = `field${i}`;

    // Randomly choose a data type
    const typeRoll = Math.random();

    if (typeRoll < 0.3) {
      // String
      record[key] = generateRandomString(stringLength);
    } else if (typeRoll < 0.5) {
      // Number
      record[key] = Math.random() * 10000;
    } else if (typeRoll < 0.6) {
      // Boolean
      record[key] = Math.random() > 0.5;
    } else if (typeRoll < 0.8 && withArrays) {
      // Array
      const arrayLength = Math.floor(Math.random() * 5) + 1;
      const array = [];

      for (let j = 0; j < arrayLength; j++) {
        if (depth > 1 && Math.random() > 0.7 && withNestedObjects) {
          array.push(generateRandomRecord(Math.max(2, keyCount - 4), stringLength, depth - 1, withArrays, withNestedObjects));
        } else {
          array.push(generateRandomString(stringLength / 2));
        }
      }

      record[key] = array;
    } else if (withNestedObjects && depth > 1) {
      // Nested object
      record[key] = generateRandomRecord(Math.max(2, keyCount - 3), stringLength, depth - 1, withArrays, withNestedObjects);
    } else {
      // Default to string
      record[key] = generateRandomString(stringLength);
    }
  }

  return record;
}

/**
 * Generate a random JSON object with specified number of records
 * @param {number} count - Number of records to generate
 * @param {Object} options - Generation options
 * @returns {Object} Generated JSON data
 */
export function generateRandomJson(count = 1000, options = {}) {
  const {
    depth = 2,
    cacheFile = null,
    withArrays = true,
    withNestedObjects = true,
    keyCount = 10,
    stringLength = 20
  } = options;

  // Check if we have a cached version
  if (cacheFile) {
    const cacheFilePath = join(TEST_DATA_DIR, cacheFile);
    try {
      if (existsSync(cacheFilePath)) {
        const cachedData = JSON.parse(readFileSync(cacheFilePath, 'utf8'));
        return cachedData;
      }
    } catch (err) {
      console.warn('Error reading cache file:', err instanceof Error ? err.message : String(err));
    }
  }

  // Create records
  const records = [];
  for (let i = 0; i < count; i++) {
    records.push(generateRandomRecord(keyCount, stringLength, depth, withArrays, withNestedObjects));
  }

  const result = {
    records,
    metadata: {
      generated: new Date().toISOString(),
      count,
      options
    }
  };

  // Cache the result if requested
  if (cacheFile) {
    try {
      const cacheFilePath = join(TEST_DATA_DIR, cacheFile);
      writeFileSync(cacheFilePath, JSON.stringify(result));
    } catch (err) {
      console.warn('Error writing cache file:', err instanceof Error ? err.message : String(err));
    }
  }

  return result;
}

/**
 * Generate a large text document
 * @param {number} paragraphs - Number of paragraphs to generate
 * @returns {string} Generated text
 */
export function generateLargeTextDocument(paragraphs = 100) {
  // Words to use in generation
  const words = [
    'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
    'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
    'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud', 'exercitation',
    'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo', 'consequat',
    'duis', 'aute', 'irure', 'dolor', 'reprehenderit', 'voluptate', 'velit', 'esse',
    'cillum', 'eu', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint', 'occaecat',
    'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia', 'deserunt',
    'mollit', 'anim', 'id', 'est', 'laborum', 'performance', 'optimization', 'stream',
    'processing', 'buffer', 'memory', 'allocation', 'garbage', 'collection', 'latency',
    'throughput', 'nexure', 'framework', 'http', 'server', 'request', 'response',
    'middleware', 'pipeline', 'async', 'await', 'promise', 'callback', 'event',
    'loop', 'node', 'javascript', 'typescript', 'module', 'import', 'export'
  ];

  // Generate paragraphs
  const result = [];

  for (let i = 0; i < paragraphs; i++) {
    const paragraphLength = Math.floor(Math.random() * 150) + 50; // 50-200 words
    const paragraph = [];

    // First sentence is longer with capital first letter
    const firstSentenceLength = Math.floor(Math.random() * 10) + 10;
    const firstSentence = [];

    for (let j = 0; j < firstSentenceLength; j++) {
      const word = words[Math.floor(Math.random() * words.length)];
      firstSentence.push(j === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word);
    }

    paragraph.push(firstSentence.join(' ') + '.');

    // Generate more sentences
    let wordsAdded = firstSentenceLength;
    while (wordsAdded < paragraphLength) {
      const sentenceLength = Math.floor(Math.random() * 10) + 5;
      const sentence = [];

      for (let j = 0; j < sentenceLength && wordsAdded < paragraphLength; j++) {
        sentence.push(words[Math.floor(Math.random() * words.length)]);
        wordsAdded++;
      }

      // Add sentence to paragraph
      paragraph.push(sentence.join(' ') + '.');
    }

    // Combine sentences into a paragraph
    result.push(paragraph.join(' '));
  }

  // Combine paragraphs into a document
  return result.join('\n\n');
}

/**
 * Generate very large JSON array data for stream testing
 * @param {number} recordCount - Number of records to generate
 * @param {number} avgRecordSize - Average record size in bytes
 * @returns {string} JSON array string
 */
export function generateLargeJsonArray(recordCount = 10000, avgRecordSize = 1000) {
  // Check if we have a cached version
  const cacheFile = `large-array-${recordCount}-${avgRecordSize}.json`;
  const cacheFilePath = join(TEST_DATA_DIR, cacheFile);

  try {
    if (existsSync(cacheFilePath)) {
      return readFileSync(cacheFilePath, 'utf8');
    }
  } catch (err) {
    console.warn('Error reading cache file:', err instanceof Error ? err.message : String(err));
  }

  // Generate array opening bracket
  let result = '[';

  // Generate records
  for (let i = 0; i < recordCount; i++) {
    const record = generateRandomRecord(
      Math.floor(avgRecordSize / 100),  // Roughly scale keyCount to achieve size
      20,
      2,
      true,
      true
    );

    // Add comma if not the first record
    if (i > 0) {
      result += ',';
    }

    // Add record as JSON
    result += JSON.stringify(record);
  }

  // Close array
  result += ']';

  // Cache the result
  try {
    writeFileSync(cacheFilePath, result);
  } catch (err) {
    console.warn('Error writing cache file:', err instanceof Error ? err.message : String(err));
  }

  return result;
}

/**
 * Generate binary data for testing
 * @param {number} sizeInMB - Size in megabytes
 * @returns {Buffer} Random binary data
 */
export function generateBinaryData(sizeInMB = 10) {
  const sizeInBytes = sizeInMB * 1024 * 1024;

  // Check if we have a cached version
  const cacheFile = `binary-${sizeInMB}mb.bin`;
  const cacheFilePath = join(TEST_DATA_DIR, cacheFile);

  try {
    if (existsSync(cacheFilePath)) {
      return readFileSync(cacheFilePath);
    }
  } catch (err) {
    console.warn('Error reading cache file:', err instanceof Error ? err.message : String(err));
  }

  // Generate random data
  const buffer = crypto.randomBytes(sizeInBytes);

  // Cache the result
  try {
    writeFileSync(cacheFilePath, buffer);
  } catch (err) {
    console.warn('Error writing cache file:', err instanceof Error ? err.message : String(err));
  }

  return buffer;
}

export default {
  generateRandomJson,
  generateNestedObject,
  generateLargeTextDocument,
  generateLargeJsonArray,
  generateBinaryData,
  generateRandomBinaryBuffer
};
