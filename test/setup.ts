/**
 * Global test setup for NexureJS
 * This file runs before all tests
 */

import { jest, beforeAll, afterAll } from '@jest/globals';
import { HttpParser, RadixRouter, JsonProcessor } from '../src/native/index.js';

// Set test environment variables
process.env.NODE_ENV = 'test';

// Global beforeAll hook - runs once before all tests
beforeAll(async () => {
  console.log('Starting NexureJS test suite...');

  // Initialize native modules if available
  try {
    const httpParser = new HttpParser();
    console.log('Native HttpParser initialized');
  } catch (error) {
    console.warn('Native HttpParser not available, tests might only cover JS fallback');
  }

  try {
    const radixRouter = new RadixRouter();
    console.log('Native RadixRouter initialized');
  } catch (error) {
    console.warn('Native RadixRouter not available, tests might only cover JS fallback');
  }

  try {
    const jsonProcessor = new JsonProcessor();
    console.log('Native JsonProcessor initialized');
  } catch (error) {
    console.warn('Native JsonProcessor not available, tests might only cover JS fallback');
  }
});

// Global afterAll hook - runs once after all tests
afterAll(() => {
  console.log('Completed NexureJS test suite');
  // Clean up global resources
});

// Add global mocks or test utilities
global.mockRequest = (options = {}) => {
  return {
    headers: {},
    method: 'GET',
    url: '/',
    params: {},
    query: {},
    body: {},
    ...options
  };
};

global.mockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.getHeader = jest.fn().mockReturnValue('');
  res.headersSent = false;
  return res;
};

// Add type definitions for global test utilities
declare global {
  namespace NodeJS {
    interface Global {
      mockRequest: (options?: any) => any;
      mockResponse: () => any;
    }
  }
}
