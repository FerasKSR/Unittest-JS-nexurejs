/**
 * Schema Validation Benchmarks
 *
 * Compares the performance of native C++ schema validation implementation
 * against the JavaScript implementation using Ajv.
 */

import { runBenchmark, compareResults } from './index.js';
import Ajv from 'ajv';

// Create Ajv instances
const ajv = new Ajv();
const nativeValidator = new Ajv(); // Using the same Ajv instance for both benchmarks

// Simple schema for validation
const simpleSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number' },
    email: { type: 'string', format: 'email' },
    isActive: { type: 'boolean' }
  },
  required: ['name', 'age', 'email']
};

// Complex schema for validation
const complexSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' },
    user: {
      type: 'object',
      properties: {
        firstName: { type: 'string', minLength: 2 },
        lastName: { type: 'string', minLength: 2 },
        email: { type: 'string', format: 'email' },
        age: { type: 'number', minimum: 18, maximum: 100 },
        address: {
          type: 'object',
          properties: {
            street: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string', maxLength: 2 },
            zipCode: { type: 'string', pattern: '^\\d{5}(-\\d{4})?$' }
          },
          required: ['street', 'city', 'state', 'zipCode']
        },
        phoneNumbers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['home', 'work', 'mobile'] },
              number: { type: 'string', pattern: '^\\+?[0-9\\s-()]{10,20}$' }
            },
            required: ['type', 'number']
          },
          minItems: 1
        }
      },
      required: ['firstName', 'lastName', 'email', 'age']
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      uniqueItems: true
    },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    status: { type: 'string', enum: ['pending', 'active', 'suspended', 'deleted'] },
    metadata: {
      type: 'object',
      additionalProperties: true
    }
  },
  required: ['id', 'user', 'createdAt', 'status']
};

// Sample data for simple schema
const simpleValidData = {
  name: 'John Doe',
  age: 30,
  email: 'john.doe@example.com',
  isActive: true
};

const simpleInvalidData = {
  name: 'John Doe',
  age: 'thirty', // Should be a number
  email: 'john.doe@example.com'
};

// Sample data for complex schema
const complexValidData = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  user: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    age: 30,
    address: {
      street: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zipCode: '12345'
    },
    phoneNumbers: [
      { type: 'home', number: '555-1234' },
      { type: 'mobile', number: '555-5678' }
    ]
  },
  tags: ['user', 'premium', 'verified'],
  createdAt: '2023-01-01T12:00:00Z',
  updatedAt: '2023-01-02T12:00:00Z',
  status: 'active',
  metadata: {
    lastLogin: '2023-01-02T12:00:00Z',
    preferences: {
      theme: 'dark',
      notifications: true
    }
  }
};

const complexInvalidData = {
  id: 'invalid-uuid',
  user: {
    firstName: 'J', // Too short
    lastName: 'Doe',
    email: 'invalid-email',
    age: 15, // Below minimum
    address: {
      street: '123 Main St',
      city: 'Anytown',
      state: 'California', // Too long
      zipCode: '12345'
    },
    phoneNumbers: [] // Empty array
  },
  createdAt: '2023-01-01T12:00:00Z',
  status: 'unknown' // Not in enum
};

// Compile schemas
const nativeSimpleValidator = nativeValidator.compile(simpleSchema);
const nativeComplexValidator = nativeValidator.compile(complexSchema);
const jsSimpleValidator = ajv.compile(simpleSchema);
const jsComplexValidator = ajv.compile(complexSchema);

/**
 * Benchmark simple schema validation
 */
function benchmarkSimpleSchemaValidation(): void {
  console.log('\n=== Simple Schema Validation ===');

  // Benchmark native simple schema validation
  const nativeResult = runBenchmark(
    'Native Simple Schema Validation',
    'Schema',
    () => {
      nativeSimpleValidator(simpleValidData);
      nativeSimpleValidator(simpleInvalidData);
    },
    10000
  );

  // Benchmark JS simple schema validation
  const jsResult = runBenchmark(
    'JS Simple Schema Validation',
    'Schema',
    () => {
      jsSimpleValidator(simpleValidData);
      jsSimpleValidator(simpleInvalidData);
    },
    10000
  );

  compareResults(nativeResult, jsResult);
}

/**
 * Benchmark complex schema validation
 */
function benchmarkComplexSchemaValidation(): void {
  console.log('\n=== Complex Schema Validation ===');

  // Benchmark native complex schema validation
  const nativeResult = runBenchmark(
    'Native Complex Schema Validation',
    'Schema',
    () => {
      nativeComplexValidator(complexValidData);
      nativeComplexValidator(complexInvalidData);
    },
    10000
  );

  // Benchmark JS complex schema validation
  const jsResult = runBenchmark(
    'JS Complex Schema Validation',
    'Schema',
    () => {
      jsComplexValidator(complexValidData);
      jsComplexValidator(complexInvalidData);
    },
    10000
  );

  compareResults(nativeResult, jsResult);
}

/**
 * Run all schema validation benchmarks
 */
export async function runSchemaValidationBenchmarks(): Promise<void> {
  benchmarkSimpleSchemaValidation();
  benchmarkComplexSchemaValidation();
}
