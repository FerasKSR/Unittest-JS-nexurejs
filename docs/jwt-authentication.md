# JWT Authentication in NexureJS

NexureJS provides a robust JWT (JSON Web Token) authentication system that allows you to secure your application with token-based authentication. This document explains how to use the JWT authentication features in your NexureJS application.

## Overview

JWT authentication is a stateless authentication mechanism that works by issuing a signed token to the client upon successful authentication. The client includes this token in subsequent requests, and the server verifies the token to authenticate the user.

NexureJS implements JWT authentication with the following features:

- Token generation with configurable options
- Token verification with comprehensive security checks
- Middleware for protecting routes
- Support for custom token extraction logic
- Role-based access control

## Installation

JWT authentication is included in the NexureJS framework. No additional installation is required.

## Basic Usage

### 1. Create a JWT Authentication Middleware

```typescript
import { createJwtAuthMiddleware } from 'nexurejs/security/jwt';

// Create JWT authentication middleware
const jwtAuth = createJwtAuthMiddleware({
  secret: 'your-secret-key',
  expiresIn: 3600, // 1 hour
  issuer: 'your-application-name'
});

// Use middleware to protect routes
router.get('/protected', jwtAuth, async (req, res) => {
  // Access the authenticated user
  const user = (req as any).user;

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Protected route', user }));
});
```

### 2. Generate JWT Tokens

```typescript
import { signJwt } from 'nexurejs/security/jwt';

// User login handler
router.post('/login', async (req, res) => {
  // Authenticate user (example)
  const user = await authenticateUser(req.body.username, req.body.password);

  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid credentials' }));
    return;
  }

  // Create JWT payload
  const payload = {
    sub: user.id,
    username: user.username,
    role: user.role
  };

  // Sign JWT token
  const token = signJwt(payload, 'your-secret-key', {
    expiresIn: 3600,
    issuer: 'your-application-name'
  });

  // Return token to client
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ token }));
});
```

### 3. Verify JWT Tokens

```typescript
import { verifyJwt } from 'nexurejs/security/jwt';

// Verify a token manually
try {
  const payload = verifyJwt(token, 'your-secret-key');
  console.log('Token is valid:', payload);
} catch (error) {
  console.error('Token verification failed:', error.message);
}
```

## Configuration Options

The JWT authentication system provides several configuration options:

### JwtOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `secret` | `string` | (required) | Secret key for JWT signing |
| `algorithm` | `'HS256' \| 'HS384' \| 'HS512'` | `'HS256'` | JWT algorithm |
| `expiresIn` | `number` | `3600` | Token expiration time in seconds |
| `issuer` | `string` | `undefined` | Token issuer |
| `audience` | `string` | `undefined` | Token audience |
| `extractToken` | `(req: IncomingMessage) => string \| null` | Bearer token from Authorization header | Custom function to extract token from request |

## Advanced Usage

### Custom Token Extraction

By default, the JWT middleware extracts tokens from the `Authorization` header with the `Bearer` scheme. You can customize this behavior by providing an `extractToken` function:

```typescript
const jwtAuth = createJwtAuthMiddleware({
  secret: 'your-secret-key',
  extractToken: (req) => {
    // Extract token from custom header
    const token = req.headers['x-access-token'];
    return typeof token === 'string' ? token : null;
  }
});
```

### Role-Based Access Control

You can implement role-based access control by checking the user's role in your route handlers:

```typescript
// Admin-only route
router.get('/admin', jwtAuth, async (req, res) => {
  const user = (req as any).user;

  // Check if user has admin role
  if (user.role !== 'admin') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Access denied' }));
    return;
  }

  // Admin-only logic
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Admin area', user }));
});
```

### Combining with CSRF Protection

For enhanced security, you can combine JWT authentication with CSRF protection:

```typescript
import { createJwtAuthMiddleware } from 'nexurejs/security/jwt';
import { createCsrfMiddleware } from 'nexurejs/security/csrf';

// Create middlewares
const jwtAuth = createJwtAuthMiddleware({ secret: 'your-secret-key' });
const csrfProtection = createCsrfMiddleware();

// Apply middlewares
server.use(csrfProtection);
router.post('/api/data', jwtAuth, async (req, res) => {
  // This route is protected by both JWT and CSRF
});
```

## Security Considerations

1. **Secret Key**: Use a strong, unique secret key for JWT signing. Consider using environment variables to store the secret.

2. **HTTPS**: Always use HTTPS in production to prevent token interception.

3. **Token Expiration**: Set appropriate token expiration times. Short-lived tokens are more secure but require more frequent re-authentication.

4. **Sensitive Data**: Avoid storing sensitive data in JWT payloads, as they can be decoded (though not modified without the secret).

5. **Token Storage**: Advise clients to store tokens securely (e.g., in HttpOnly cookies or secure storage mechanisms).

## Example Application

See the `examples/jwt-auth-example.ts` file for a complete example of JWT authentication in a NexureJS application.

## Testing

Run the JWT authentication tests to verify the functionality:

```bash
node --loader ts-node/esm tests/jwt-auth.test.ts
```

Or use the test runner script:

```bash
node --loader ts-node/esm scripts/run-jwt-test.ts
```

## API Reference

### `signJwt(payload, secret, options)`

Generates a signed JWT token.

### `verifyJwt(token, secret, options)`

Verifies a JWT token and returns the payload.

### `createJwtAuthMiddleware(options)`

Creates a middleware function for JWT authentication.

## Troubleshooting

### Invalid Signature

If you're getting "Invalid JWT signature" errors, check that:
- The same secret key is used for signing and verification
- The token hasn't been tampered with
- The correct algorithm is specified

### Token Expired

If you're getting "JWT token has expired" errors:
- The token's expiration time has passed
- Check for clock skew between servers

### Invalid Issuer/Audience

If you're getting "Invalid JWT issuer" or "Invalid JWT audience" errors:
- Ensure the issuer/audience in the token matches the expected values
- Check if you're verifying tokens from a different system
