/**
 * JWT Authentication Tests
 *
 * This test file verifies the functionality of the JWT authentication middleware.
 */
import { signJwt, verifyJwt, createJwtAuthMiddleware } from '../src/security/jwt.js';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
// Mock request and response objects
function createMockRequest(headers = {}) {
    const socket = new Socket();
    const req = new IncomingMessage(socket);
    // Add headers
    Object.entries(headers).forEach(([key, value]) => {
        req.headers[key] = value;
    });
    return req;
}
function createMockResponse() {
    const req = createMockRequest();
    const res = new ServerResponse(req);
    // Capture headers
    const headers = {};
    const originalSetHeader = res.setHeader;
    res.setHeader = function (name, value) {
        headers[name.toLowerCase()] = value;
        return originalSetHeader.call(this, name, value);
    };
    // Add a way to access headers for testing
    res.getHeaders = () => headers;
    return res;
}
describe('JWT Authentication', () => {
    const secret = 'test-secret-key';
    const payload = {
        sub: '123',
        username: 'testuser',
        role: 'user'
    };
    describe('JWT token signing and verification', () => {
        it('should sign and verify tokens correctly', () => {
            // Sign token
            const token = signJwt(payload, secret);
            expect(token).toBeTruthy();
            // Verify token
            const verified = verifyJwt(token, secret);
            expect(verified).toBeTruthy();
            // Check payload
            expect(verified.sub).toBe(payload.sub);
            expect(verified.username).toBe(payload.username);
            expect(verified.role).toBe(payload.role);
            // Check expiration
            expect(verified.exp).toBeDefined();
            expect(verified.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
        });
    });
    describe('JWT middleware', () => {
        it('should handle valid tokens correctly', async () => {
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
            const next = jest.fn();
            // Call middleware
            await jwtMiddleware(req, res, next);
            // Check if next was called
            expect(next).toHaveBeenCalled();
            // Check if user was attached to request
            expect(req.user).toBeDefined();
            expect(req.user.sub).toBe(payload.sub);
            expect(req.user.username).toBe(payload.username);
            expect(req.user.role).toBe(payload.role);
        });
        it('should reject invalid tokens', async () => {
            // Create middleware
            const jwtMiddleware = createJwtAuthMiddleware({ secret });
            // Create mock request with invalid token
            const req = createMockRequest({
                'authorization': 'Bearer invalid.token.here'
            });
            // Create mock response
            const res = createMockResponse();
            // Create next function
            const next = jest.fn();
            // Call middleware and expect error
            await expect(jwtMiddleware(req, res, next))
                .rejects
                .toThrow();
            // Check that next was not called
            expect(next).not.toHaveBeenCalled();
        });
        it('should reject missing tokens', async () => {
            // Create middleware
            const jwtMiddleware = createJwtAuthMiddleware({ secret });
            // Create mock request without token
            const req = createMockRequest();
            // Create mock response
            const res = createMockResponse();
            // Create next function
            const next = jest.fn();
            // Call middleware and expect error
            await expect(jwtMiddleware(req, res, next))
                .rejects
                .toThrow();
            // Check that next was not called
            expect(next).not.toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=jwt-auth.test.js.map