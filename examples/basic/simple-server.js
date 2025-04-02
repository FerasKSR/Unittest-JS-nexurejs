/**
 * Simple Server Example
 *
 * This example demonstrates a basic HTTP server using NexureJS with:
 * - Basic routing with path parameters
 * - Request body parsing (JSON)
 * - Response formatting
 * - Error handling
 * - Middleware usage
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

// Middleware to add request timestamp
app.use((req, res, next) => {
  req.timestamp = Date.now();
  next();
});

// Middleware to log requests
app.use((req, res, next) => {
  console.log(`[${new Date(req.timestamp).toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Home route
app.route({
  path: '/',
  method: HttpMethod.GET,
  handler: (req, res) => {
    res.status(200).json({
      message: 'Welcome to NexureJS',
      version: '0.2.0',
      timestamp: req.timestamp
    });
  }
});

// Get all users route
app.route({
  path: '/api/users',
  method: HttpMethod.GET,
  handler: (req, res) => {
    // In a real app, you would fetch users from a database
    const users = [
      { id: 1, name: 'John Doe', email: 'john@example.com' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
      { id: 3, name: 'Bob Johnson', email: 'bob@example.com' }
    ];

    res.status(200).json({
      users,
      count: users.length,
      timestamp: req.timestamp
    });
  }
});

// Get user by ID route with path parameter
app.route({
  path: '/api/users/:id',
  method: HttpMethod.GET,
  handler: (req, res) => {
    const userId = parseInt(req.params.id);

    // Validate user ID
    if (isNaN(userId)) {
      return res.status(400).json({
        error: 'Invalid user ID',
        message: 'User ID must be a number'
      });
    }

    // In a real app, you would fetch the user from a database
    const users = [
      { id: 1, name: 'John Doe', email: 'john@example.com' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
      { id: 3, name: 'Bob Johnson', email: 'bob@example.com' }
    ];

    const user = users.find(u => u.id === userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: `User with ID ${userId} does not exist`
      });
    }

    res.status(200).json({
      user,
      timestamp: req.timestamp
    });
  }
});

// Create a new user route
app.route({
  path: '/api/users',
  method: HttpMethod.POST,
  handler: async (req, res) => {
    try {
      // Parse request body
      const body = await req.json();

      // Validate request body
      if (!body.name || !body.email) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Name and email are required fields'
        });
      }

      // Email validation using a simple regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Invalid email format'
        });
      }

      // In a real app, you would save the user to a database
      const newUser = {
        id: 4, // In a real app, this would be generated
        name: body.name,
        email: body.email
      };

      res.status(201).json({
        message: 'User created successfully',
        user: newUser,
        timestamp: req.timestamp
      });
    } catch (err) {
      res.status(400).json({
        error: 'Invalid request body',
        message: 'Please provide a valid JSON body'
      });
    }
  }
});

// Health check endpoint
app.route({
  path: '/health',
  method: HttpMethod.GET,
  handler: (req, res) => {
    res.status(200).json({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: req.timestamp
    });
  }
});

// Error handling for 404 (not found)
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.url} not found`,
    timestamp: req.timestamp
  });
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log('Available routes:');
  console.log('- GET  /');
  console.log('- GET  /api/users');
  console.log('- GET  /api/users/:id');
  console.log('- POST /api/users');
  console.log('- GET  /health');
});
