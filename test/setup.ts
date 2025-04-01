/**
 * Global test setup for NexureJS
 * This file runs before all tests
 */

import { jest, beforeAll, afterAll } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';

// Global beforeAll hook - runs once before all tests
beforeAll(() => {
  console.log('Starting NexureJS test suite...');
  // Add any global setup here (database connections, etc.)
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
