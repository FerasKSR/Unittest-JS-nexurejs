/**
 * Simple implementation of the Nexure class for testing
 */

import { createServer } from 'node:http';

export class Nexure {
  constructor(options = {}) {
    this.options = {
      logging: true,
      prettyJson: false,
      ...options
    };

    this.routes = new Map();
    this.server = createServer(this.handleRequest.bind(this));
  }

  /**
   * Register a GET route
   * @param {string} path - The route path
   * @param {Function} handler - The route handler
   */
  get(path, handler) {
    this.routes.set(`GET:${path}`, handler);
    return this;
  }

  /**
   * Register a POST route
   * @param {string} path - The route path
   * @param {Function} handler - The route handler
   */
  post(path, handler) {
    this.routes.set(`POST:${path}`, handler);
    return this;
  }

  /**
   * Start the server
   * @param {number} port - The port to listen on
   * @param {Function} callback - Callback function
   */
  listen(port, callback) {
    this.server.listen(port, () => {
      if (this.options.logging) {
        console.log(`Server running at http://localhost:${port}/`);
      }
      if (callback) callback();
    });

    return this.server;
  }

  /**
   * Handle incoming requests
   * @param {Object} req - The request object
   * @param {Object} res - The response object
   */
  async handleRequest(req, res) {
    const { method, url } = req;
    const path = url.split('?')[0];

    // Set default headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Powered-By', 'NexureJS');

    // Add JSON response helper
    res.json = (data) => {
      res.statusCode = 200;
      res.end(JSON.stringify(data, null, this.options.prettyJson ? 2 : 0));
    };

    try {
      // Find matching route
      const handler = this.routes.get(`${method}:${path}`);

      if (handler) {
        await handler(req, res);
      } else {
        // Route not found
        res.statusCode = 404;
        res.end(JSON.stringify({
          statusCode: 404,
          message: `Cannot ${method} ${path}`,
          timestamp: new Date().toISOString()
        }, null, this.options.prettyJson ? 2 : 0));
      }
    } catch (error) {
      // Handle errors
      console.error(`Error processing ${method} ${path}:`, error);

      res.statusCode = error.statusCode || 500;
      res.end(JSON.stringify({
        statusCode: res.statusCode,
        message: error.message || 'Internal Server Error',
        timestamp: new Date().toISOString()
      }, null, this.options.prettyJson ? 2 : 0));
    }
  }
}
