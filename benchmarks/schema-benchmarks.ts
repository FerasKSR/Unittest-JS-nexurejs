/**
 * Schema Validator Benchmarks
 *
 * Compares the performance of native C++ schema validator implementation
 * against the JavaScript implementation.
 */

import { runBenchmark, compareResults } from './index.js';
import { SchemaValidator } from '../src/native/index.js';
import Ajv from 'ajv';

// Initialize Ajv
const ajv = new Ajv({
  allErrors: true
});

// Initialize SchemaValidator
const schemaValidator = new SchemaValidator();

// Sample schemas for testing
const simpleSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 2 },
    age: { type: 'integer', minimum: 0 },
    email: { type: 'string', format: 'email' },
    active: { type: 'boolean' }
  },
  required: ['name', 'age']
};

const nestedSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    user: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        address: {
          type: 'object',
          properties: {
            street: { type: 'string' },
            city: { type: 'string' },
            zipCode: { type: 'string', pattern: '^[0-9]{5}$' }
          },
          required: ['street', 'city']
        }
      },
      required: ['name', 'email']
    },
    tags: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  required: ['id', 'user']
};

const arraySchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          price: { type: 'number', minimum: 0 },
          inStock: { type: 'boolean' }
        },
        required: ['id', 'name', 'price']
      },
      minItems: 1
    },
    pagination: {
      type: 'object',
      properties: {
        page: { type: 'integer', minimum: 1 },
        perPage: { type: 'integer', minimum: 1, maximum: 100 },
        total: { type: 'integer', minimum: 0 }
      },
      required: ['page', 'perPage']
    }
  },
  required: ['items']
};

// Sample data for testing
const simpleValid = {
  name: 'John Doe',
  age: 30,
  email: 'john@example.com',
  active: true
};

const simpleInvalid = {
  name: 'J',
  age: -5,
  email: 'not-an-email',
  active: 'yes'
};

const nestedValid = {
  id: 123,
  user: {
    name: 'Jane Smith',
    email: 'jane@example.com',
    address: {
      street: '123 Main St',
      city: 'Anytown',
      zipCode: '12345'
    }
  },
  tags: ['customer', 'premium']
};

const nestedInvalid = {
  id: '123', // should be integer
  user: {
    name: 'Jane Smith',
    // missing email
    address: {
      street: '123 Main St',
      // missing city
      zipCode: 'ABC12' // invalid pattern
    }
  },
  tags: ['customer', 123] // should all be strings
};

const arrayValid = {
  items: [
    { id: 1, name: 'Item 1', price: 9.99, inStock: true },
    { id: 2, name: 'Item 2', price: 19.99, inStock: false },
    { id: 3, name: 'Item 3', price: 29.99, inStock: true }
  ],
  pagination: {
    page: 1,
    perPage: 10,
    total: 3
  }
};

const arrayInvalid = {
  items: [
    { id: 1, name: 'Item 1', price: 9.99, inStock: true },
    { id: 2, name: 'Item 2', price: -19.99, inStock: false }, // negative price
    { id: 3, name: 'Item 3' } // missing price
  ],
  pagination: {
    page: 0, // minimum is 1
    perPage: 200, // maximum is 100
    total: 3
  }
};

// Compile Ajv validators
const ajvSimpleValidator = ajv.compile(simpleSchema);
const ajvNestedValidator = ajv.compile(nestedSchema);
const ajvArrayValidator = ajv.compile(arraySchema);

/**
 * Benchmark simple schema validation
 */
function benchmarkSimpleSchemaValidation(): void {
  console.log('\n=== Simple Schema Validation ===');

  // Benchmark native validation (valid data)
  const nativeValidResult = runBenchmark(
    'Native Simple Schema (Valid)',
    'Schema',
    () => {
      schemaValidator.validate(simpleSchema, simpleValid);
    },
    10000
  );

  // Benchmark JS validation (valid data)
  const jsValidResult = runBenchmark(
    'JS Simple Schema (Valid)',
    'Schema',
    () => {
      ajvSimpleValidator(simpleValid);
    },
    10000
  );

  compareResults(nativeValidResult, jsValidResult);

  // Benchmark native validation (invalid data)
  const nativeInvalidResult = runBenchmark(
    'Native Simple Schema (Invalid)',
    'Schema',
    () => {
      schemaValidator.validate(simpleSchema, simpleInvalid);
    },
    10000
  );

  // Benchmark JS validation (invalid data)
  const jsInvalidResult = runBenchmark(
    'JS Simple Schema (Invalid)',
    'Schema',
    () => {
      ajvSimpleValidator(simpleInvalid);
    },
    10000
  );

  compareResults(nativeInvalidResult, jsInvalidResult);
}

/**
 * Benchmark nested schema validation
 */
function benchmarkNestedSchemaValidation(): void {
  console.log('\n=== Nested Schema Validation ===');

  // Benchmark native validation (valid data)
  const nativeValidResult = runBenchmark(
    'Native Nested Schema (Valid)',
    'Schema',
    () => {
      schemaValidator.validate(nestedSchema, nestedValid);
    },
    10000
  );

  // Benchmark JS validation (valid data)
  const jsValidResult = runBenchmark(
    'JS Nested Schema (Valid)',
    'Schema',
    () => {
      ajvNestedValidator(nestedValid);
    },
    10000
  );

  compareResults(nativeValidResult, jsValidResult);

  // Benchmark native validation (invalid data)
  const nativeInvalidResult = runBenchmark(
    'Native Nested Schema (Invalid)',
    'Schema',
    () => {
      schemaValidator.validate(nestedSchema, nestedInvalid);
    },
    10000
  );

  // Benchmark JS validation (invalid data)
  const jsInvalidResult = runBenchmark(
    'JS Nested Schema (Invalid)',
    'Schema',
    () => {
      ajvNestedValidator(nestedInvalid);
    },
    10000
  );

  compareResults(nativeInvalidResult, jsInvalidResult);
}

/**
 * Benchmark array schema validation
 */
function benchmarkArraySchemaValidation(): void {
  console.log('\n=== Array Schema Validation ===');

  // Benchmark native validation (valid data)
  const nativeValidResult = runBenchmark(
    'Native Array Schema (Valid)',
    'Schema',
    () => {
      schemaValidator.validate(arraySchema, arrayValid);
    },
    10000
  );

  // Benchmark JS validation (valid data)
  const jsValidResult = runBenchmark(
    'JS Array Schema (Valid)',
    'Schema',
    () => {
      ajvArrayValidator(arrayValid);
    },
    10000
  );

  compareResults(nativeValidResult, jsValidResult);

  // Benchmark native validation (invalid data)
  const nativeInvalidResult = runBenchmark(
    'Native Array Schema (Invalid)',
    'Schema',
    () => {
      schemaValidator.validate(arraySchema, arrayInvalid);
    },
    10000
  );

  // Benchmark JS validation (invalid data)
  const jsInvalidResult = runBenchmark(
    'JS Array Schema (Invalid)',
    'Schema',
    () => {
      ajvArrayValidator(arrayInvalid);
    },
    10000
  );

  compareResults(nativeInvalidResult, jsInvalidResult);
}

/**
 * Run all schema validator benchmarks
 */
export async function runSchemaBenchmarks(): Promise<void> {
  benchmarkSimpleSchemaValidation();
  benchmarkNestedSchemaValidation();
  benchmarkArraySchemaValidation();
}
