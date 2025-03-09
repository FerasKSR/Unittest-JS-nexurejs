/**
 * Simple JWT Authentication Test
 *
 * This script tests the JWT authentication functionality directly without requiring a server.
 */

import { signJwt, verifyJwt } from '../src/security/jwt.js';

// Test data
const secret = 'test-secret-key';
const payload = {
  sub: '123',
  username: 'testuser',
  role: 'admin'
};

console.log('=== Simple JWT Authentication Test ===\n');

// Test JWT signing
console.log('Testing JWT token signing...');
const token = signJwt(payload, secret);
console.log('✓ Token generated successfully');
console.log(`Token: ${token}\n`);

// Test JWT verification
console.log('Testing JWT token verification...');
try {
  const verified = verifyJwt(token, secret);
  console.log('✓ Token verified successfully');
  console.log('Verified payload:', verified);

  // Check if payload matches
  console.log('\nChecking payload...');
  if (verified.sub === payload.sub &&
      verified.username === payload.username &&
      verified.role === payload.role) {
    console.log('✓ Payload matches original data');
  } else {
    console.log('✗ Payload does not match original data');
    console.log('Original:', payload);
    console.log('Verified:', verified);
  }

  // Check expiration
  console.log('\nChecking expiration...');
  if (verified.exp && verified.exp > Math.floor(Date.now() / 1000)) {
    console.log('✓ Expiration time set correctly');
    console.log(`Expires at: ${new Date(verified.exp * 1000).toISOString()}`);
  } else {
    console.log('✗ Expiration time not set correctly');
  }

} catch (error) {
  console.error('✗ Token verification failed:', error.message);
}

// Test invalid token
console.log('\nTesting invalid token...');
try {
  const invalidToken = token.substring(0, token.length - 5) + 'XXXXX';
  verifyJwt(invalidToken, secret);
  console.log('✗ Invalid token was accepted');
} catch (error) {
  console.log('✓ Invalid token correctly rejected:', error.message);
}

// Test wrong secret
console.log('\nTesting wrong secret...');
try {
  verifyJwt(token, 'wrong-secret');
  console.log('✗ Token with wrong secret was accepted');
} catch (error) {
  console.log('✓ Token with wrong secret correctly rejected:', error.message);
}

console.log('\n=== Test completed ===');
