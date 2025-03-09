/**
 * JWT Authentication Tests
 *
 * This test file verifies the functionality of the JWT authentication middleware.
 */

import { signJwt, verifyJwt, createJwtAuthMiddleware } from '../src/security/jwt.js';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import assert from 'node:assert';

// Mock request and response objects
function createMockRequest(headers: Record<string, string> = {}): IncomingMessage {
  const socket = new Socket();
  const req = new IncomingMessage(socket);

  // Add headers
  Object.entries(headers).forEach(([key, value]) => {
    req.headers[key] = value;
  });

  return req;
}

function createMockResponse(): ServerResponse {
  const req = createMockRequest();
  const res = new ServerResponse(req);

  // Capture headers
  const headers: Record<string, string> = {};
  const originalSetHeader = res.setHeader;
  res.setHeader = function(name: string, value: string) {
    headers[name.toLowerCase()] = value;
    return originalSetHeader.call(this, name, value);
  };

  // Add a way to access headers for testing
  (res as any).getHeaders = () => headers;

  return res;
}

// Test JWT token signing and verification
async function testJwtSignAndVerify() {
  console.log('Testing JWT token signing and verification...');

  const secret = 'test-secret-key';
  const payload = {
    sub: '123',
    username: 'testuser',
    role: 'user'
  };

  // Sign token
  const token = signJwt(payload, secret);
  console.log('✓ Token generated successfully');

  // Verify token
  const verified = verifyJwt(token, secret);
  console.log('✓ Token verified successfully');

  // Check payload
  assert.strictEqual(verified.sub, payload.sub);
  assert.strictEqual(verified.username, payload.username);
  assert.strictEqual(verified.role, payload.role);
  console.log('✓ Payload matches original data');

  // Check expiration
  assert(verified.exp && verified.exp > Math.floor(Date.now() / 1000));
  console.log('✓ Expiration time set correctly');

  return true;
}

// Test JWT middleware with valid token
async function testJwtMiddlewareWithValidToken() {
  console.log('\nTesting JWT middleware with valid token...');

  const secret = 'test-secret-key';
  const payload = {
    sub: '123',
    username: 'testuser',
    role: 'user'
  };

  // Sign token
  const token = signJwt(payload, secret);

  // Create middleware
  const jwtMiddleware = createJwtAuthMiddleware({ secret });

  // Create mock request with token
  const req = createMockRequest({
    'authorization': `Bearer ${token}`
  });

  // Create mock response
  const res = createMockResponse();

  // Create next function
  let nextCalled = false;
  const next = async () => {
    nextCalled = true;
  };

  // Call middleware
  await jwtMiddleware(req, res, next);

  // Check if next was called
  assert(nextCalled, 'Next function should be called');
  console.log('✓ Next function called');

  // Check if user was attached to request
  assert((req as any).user, 'User should be attached to request');
  assert.strictEqual((req as any).user.sub, payload.sub);
  assert.strictEqual((req as any).user.username, payload.username);
  assert.strictEqual((req as any).user.role, payload.role);
  console.log('✓ User attached to request');

  return true;
}

// Test JWT middleware with invalid token
async function testJwtMiddlewareWithInvalidToken() {
  console.log('\nTesting JWT middleware with invalid token...');

  const secret = 'test-secret-key';

  // Create middleware
  const jwtMiddleware = createJwtAuthMiddleware({ secret });

  // Create mock request with invalid token
  const req = createMockRequest({
    'authorization': 'Bearer invalid.token.here'
  });

  // Create mock response
  const res = createMockResponse();

  // Create next function
  let nextCalled = false;
  const next = async () => {
    nextCalled = true;
  };

  // Call middleware and expect error
  try {
    await jwtMiddleware(req, res, next);
    assert.fail('Middleware should throw an error for invalid token');
  } catch (error) {
    console.log('✓ Middleware rejected invalid token');
    assert(!nextCalled, 'Next function should not be called');
    console.log('✓ Next function not called');
  }

  return true;
}

// Test JWT middleware with missing token
async function testJwtMiddlewareWithMissingToken() {
  console.log('\nTesting JWT middleware with missing token...');

  const secret = 'test-secret-key';

  // Create middleware
  const jwtMiddleware = createJwtAuthMiddleware({ secret });

  // Create mock request without token
  const req = createMockRequest();

  // Create mock response
  const res = createMockResponse();

  // Create next function
  let nextCalled = false;
  const next = async () => {
    nextCalled = true;
  };

  // Call middleware and expect error
  try {
    await jwtMiddleware(req, res, next);
    assert.fail('Middleware should throw an error for missing token');
  } catch (error) {
    console.log('✓ Middleware rejected request with missing token');
    assert(!nextCalled, 'Next function should not be called');
    console.log('✓ Next function not called');
  }

  return true;
}

// Run all tests
async function runTests() {
  console.log('=== JWT Authentication Tests ===\n');

  try {
    await testJwtSignAndVerify();
    await testJwtMiddlewareWithValidToken();
    await testJwtMiddlewareWithInvalidToken();
    await testJwtMiddlewareWithMissingToken();

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
runTests();
