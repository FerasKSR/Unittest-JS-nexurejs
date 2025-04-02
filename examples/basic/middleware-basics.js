/**
 * Middleware Basics Example
 *
 * This example demonstrates different middleware usage patterns in NexureJS:
 * - Global middleware (applied to all routes)
 * - Route-specific middleware
 * - Error-handling middleware
 * - Middleware chaining
 * - Conditional middleware
 * - Response time tracking
 *
 * For complete API documentation, see:
 * - API Reference: ../../docs/API_REFERENCE.md
 * - Examples Guide: ../../docs/EXAMPLES.md
 */

import { Nexure, HttpMethod } from '../../src/index.js';

// Create a new Nexure application instance
const app = new Nexure({
  logger: {
    level: 'info',
    prettyPrint: true
  }
});

// -----------------------------------
// Global Middleware Examples
// -----------------------------------

// 1. Request logger middleware
const requestLogger = (req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
};

// 2. Response time middleware
const responseTime = (req, res, next) => {
  const start = Date.now();

  // Add a hook to track when the response is sent
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`Request to ${req.url} took ${duration}ms`);
  });

  next();
};

// 3. CORS middleware
const corsMiddleware = (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
};

// Apply global middleware
app.use(requestLogger);
app.use(responseTime);
app.use(corsMiddleware);

// -----------------------------------
// Route-specific Middleware Examples
// -----------------------------------

// 1. Authentication check middleware (simplified)
const authCheck = (req, res, next) => {
  // Check for a token in the Authorization header
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication token is required'
    });
  }

  const token = authHeader.split(' ')[1];

  // In a real app, you would validate the token
  // This is a simplified check for demo purposes
  if (token !== 'valid-demo-token') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid authentication token'
    });
  }

  // Add user info to request
  req.user = { id: 123, name: 'Demo User' };
  next();
};

// 2. Role validation middleware
const requireAdmin = (req, res, next) => {
  // This middleware assumes authCheck has already run
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'User not authenticated'
    });
  }

  // In a real app, you would check the user's role
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required'
    });
  }

  next();
};

// 3. Request validation middleware
const validateUserInput = (req, res, next) => {
  try {
    // This would normally check the body against a schema
    // Simplified version for demo purposes
    const body = req.body;

    if (!body || typeof body !== 'object') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Request body is required and must be an object'
      });
    }

    if (!body.name || typeof body.name !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Name is required and must be a string'
      });
    }

    next();
  } catch (err) {
    next(err);
  }
};

// -----------------------------------
// Routes with Middleware
// -----------------------------------

// Public route - no auth required
app.route({
  path: '/',
  method: HttpMethod.GET,
  handler: (req, res) => {
    res.status(200).json({
      message: 'Welcome to the Middleware Demo API',
      endpoints: {
        public: ['/'],
        protected: ['/api/profile', '/api/admin']
      }
    });
  }
});

// Protected route with authentication middleware
app.route({
  path: '/api/profile',
  method: HttpMethod.GET,
  middleware: [authCheck], // Apply auth middleware to this route only
  handler: (req, res) => {
    // req.user was added by the authCheck middleware
    res.status(200).json({
      message: 'Protected profile route',
      user: req.user
    });
  }
});

// Admin-only route with multiple middleware
app.route({
  path: '/api/admin',
  method: HttpMethod.GET,
  middleware: [authCheck, requireAdmin], // Chain multiple middleware
  handler: (req, res) => {
    res.status(200).json({
      message: 'Admin-only route',
      user: req.user,
      adminDashboardData: {
        users: 1000,
        activeUsers: 750,
        serverStatus: 'healthy'
      }
    });
  }
});

// Route with request validation middleware
app.route({
  path: '/api/data',
  method: HttpMethod.POST,
  middleware: [authCheck, validateUserInput], // Validate after auth
  handler: (req, res) => {
    res.status(201).json({
      message: 'Data received successfully',
      data: req.body
    });
  }
});

// -----------------------------------
// Conditional Middleware Example
// -----------------------------------

// Middleware that only runs in development
const developmentOnly = (req, res, next) => {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    console.log('Development-only middleware running');
    // Add some development-specific data to the request
    req.devInfo = {
      nodeEnv: process.env.NODE_ENV,
      timestamp: Date.now()
    };
  }

  next();
};

app.use(developmentOnly);

// Route that uses development info if available
app.route({
  path: '/debug',
  method: HttpMethod.GET,
  handler: (req, res) => {
    if (req.devInfo) {
      return res.status(200).json({
        message: 'Debug information (development only)',
        debugInfo: req.devInfo
      });
    }

    res.status(404).json({
      error: 'Not Found',
      message: 'Debug info is only available in development mode'
    });
  }
});

// -----------------------------------
// Error Handling Middleware
// -----------------------------------

// Route that generates an error
app.route({
  path: '/error-test',
  method: HttpMethod.GET,
  handler: () => {
    // Deliberately throw an error
    throw new Error('This is a test error');
  }
});

// Error handling middleware - must have 4 parameters!
app.use((err, req, res, next) => {
  console.error(`Error handling request to ${req.url}:`, err.message);

  // Log stack trace in development
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV !== 'production'
      ? err.message
      : 'An unexpected error occurred'
  });
});

// 404 handler - for routes that weren't matched
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.url} not found`
  });
});

// -----------------------------------
// Start the server
// -----------------------------------
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Middleware demo server running at http://localhost:${port}`);
  console.log('Available routes:');
  console.log('- GET  / (public)');
  console.log('- GET  /api/profile (requires auth)');
  console.log('- GET  /api/admin (requires admin role)');
  console.log('- POST /api/data (requires auth + valid input)');
  console.log('- GET  /debug (shows extra info in development)');
  console.log('- GET  /error-test (demonstrates error handling)');
  console.log('\nFor protected routes, use the header:');
  console.log('Authorization: Bearer valid-demo-token');
});
