/**
 * Run NexureJS Framework
 *
 * This script starts the NexureJS framework with all features enabled,
 * including JWT authentication, CSRF protection, and optimized routing.
 */

import { createServer } from '../src/http/server';
import { RadixRouter, Router } from '../src/routing/router';
import { createJwtAuthMiddleware, signJwt } from '../src/security/jwt';
import { createCsrfMiddleware } from '../src/security/csrf';
import { ClusterManager } from '../src/concurrency/cluster-manager';
import { RequestPool, ResponsePool } from '../src/http/request-pool';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Logger } from '../src/logging/logger';

// Check if we're in the primary process
import cluster from 'node:cluster';

const logger = new Logger();
logger.info('Starting NexureJS Framework');

// Create request and response pools for performance
const requestPool = new RequestPool({ maxSize: 1000 });
const responsePool = new ResponsePool({ maxSize: 1000 });

// JWT configuration
const JWT_SECRET = 'nexurejs-framework-secret-key';
const jwtAuth = createJwtAuthMiddleware({
  secret: JWT_SECRET,
  expiresIn: 3600
});

// CSRF protection
const csrfProtection = createCsrfMiddleware();

// Create router (use RadixRouter for optimized routing)
const router = new Router();

// Define routes
router.get('/', async (req: IncomingMessage, res: ServerResponse) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    message: 'NexureJS Framework is running!',
    version: '1.0.0',
    features: [
      'JWT Authentication',
      'CSRF Protection',
      'Optimized Routing (Radix Tree)',
      'Request/Response Pooling',
      'Cluster Support'
    ],
    endpoints: {
      '/': 'This information',
      '/login': 'Get a JWT token',
      '/protected': 'JWT protected route',
      '/csrf-form': 'CSRF protection example',
      '/cluster-info': 'Cluster information'
    }
  }));
});

// Login endpoint to get a JWT token
router.get('/login', async (req: IncomingMessage, res: ServerResponse) => {
  // In a real app, you would authenticate the user
  const user = {
    id: '1',
    username: 'test',
    role: 'user'
  };

  // Create JWT token
  const token = signJwt({
    sub: user.id,
    username: user.username,
    role: user.role
  }, JWT_SECRET);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    message: 'Login successful',
    token,
    user
  }));
});

// Protected route
router.get('/protected', jwtAuth, async (req: IncomingMessage, res: ServerResponse) => {
  const user = (req as any).user;

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    message: 'This is a protected route',
    user,
    timestamp: new Date().toISOString()
  }));
});

// CSRF form example
router.get('/csrf-form', async (req: IncomingMessage, res: ServerResponse) => {
  const csrfToken = (req as any).csrfToken;

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>CSRF Protection Example</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        form { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        input, button { margin: 10px 0; padding: 8px; }
        button { background: #4CAF50; color: white; border: none; cursor: pointer; }
      </style>
    </head>
    <body>
      <h1>CSRF Protection Example</h1>
      <form action="/submit-form" method="post">
        <input type="hidden" name="_csrf" value="${csrfToken}">
        <div>
          <label for="name">Name:</label>
          <input type="text" id="name" name="name">
        </div>
        <div>
          <label for="email">Email:</label>
          <input type="email" id="email" name="email">
        </div>
        <button type="submit">Submit</button>
      </form>
    </body>
    </html>
  `);
});

// Cluster information
router.get('/cluster-info', async (req: IncomingMessage, res: ServerResponse) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    clusterId: cluster.isPrimary ? 'primary' : `worker-${cluster.worker?.id}`,
    workerId: cluster.worker?.id,
    pid: process.pid,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpus: require('os').cpus().length
  }));
});

// Submit form endpoint (with CSRF protection)
router.post('/submit-form', csrfProtection, async (req: IncomingMessage, res: ServerResponse) => {
  // In a real app, you would process the form data
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Form Submitted</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .success { background: #dff0d8; padding: 20px; border-radius: 5px; }
      </style>
    </head>
    <body>
      <h1>Form Submitted</h1>
      <div class="success">
        <p>Your form has been submitted successfully!</p>
        <p>CSRF protection worked correctly.</p>
        <p><a href="/csrf-form">Back to form</a></p>
      </div>
    </body>
    </html>
  `);
});

// If we're in the primary process, start the cluster manager
if (cluster.isPrimary) {
  logger.info('Starting cluster manager');

  const clusterManager = new ClusterManager({
    numWorkers: 2, // Use 2 workers for testing
    restartOnExit: true
  });

  clusterManager.on('fork', (worker) => {
    logger.info(`Worker ${worker.id} forked`);
  });

  clusterManager.on('online', (worker) => {
    logger.info(`Worker ${worker.id} is online`);
  });

  clusterManager.on('exit', (worker, code, signal) => {
    logger.warn(`Worker ${worker.id} exited with code ${code} and signal ${signal}`);
  });

  clusterManager.start();

  logger.info(`Primary process running with PID ${process.pid}`);
} else {
  // Worker process - start the server
  const server = createServer({
    port: 3000
  }, router);

  // Add middleware
  server.use(csrfProtection);

  // Start server
  server.start(() => {
    logger.info(`Worker ${cluster.worker?.id} running with PID ${process.pid}`);
    logger.info('Server running at http://localhost:3000');
  });
}
