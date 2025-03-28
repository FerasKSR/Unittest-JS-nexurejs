/**
 * CommonJS Compatibility Layer
 *
 * This file provides a bridge for using NexureJS in CommonJS environments.
 * It dynamically imports the ESM modules and re-exports them as CommonJS exports.
 */

async function initializeCompatibilityLayer() {
  try {
    console.log('Loading NexureJS via CommonJS compatibility layer...');

    // Dynamically import core modules
    const { createServer, configureNativeModules } = await import('./index.js');
    const { Router, RadixRouter } = await import('./routing/router.js');
    const { createMiddleware } = await import('./middleware/middleware.js');
    const { Logger } = await import('./logging/logger.js');

    // Authentication and security
    const { createJwtAuthMiddleware, signJwt, verifyJwt } = await import('./security/jwt.js');
    const { createCsrfMiddleware } = await import('./security/csrf.js');
    const { RateLimiter } = await import('./security/rate-limiter.js');

    // Performance and utilities
    const { ClusterManager } = await import('./concurrency/cluster-manager.js');
    const { RequestPool, ResponsePool } = await import('./http/request-pool.js');
    const { PerformanceMonitor } = await import('./utils/performance.js');

    // Export all modules
    module.exports = {
      // Core
      createServer,
      configureNativeModules,
      Router,
      RadixRouter,

      // Middleware
      createMiddleware,

      // Logging
      Logger,

      // Authentication and security
      createJwtAuthMiddleware,
      signJwt,
      verifyJwt,
      createCsrfMiddleware,
      RateLimiter,

      // Performance
      ClusterManager,
      RequestPool,
      ResponsePool,
      PerformanceMonitor,

      // Utility to check if running in CommonJS compatibility mode
      isCompatibilityMode: true
    };

    console.log('NexureJS CommonJS compatibility layer initialized successfully');
  } catch (error) {
    console.error('Failed to initialize NexureJS CommonJS compatibility layer:', error);

    // Provide an error handler in the exports
    module.exports = {
      createServer: () => {
        throw new Error('NexureJS failed to load in CommonJS mode. See previous errors for details.');
      },
      initializationError: error
    };
  }
}

// Initialize the compatibility layer
initializeCompatibilityLayer();

// Export a temporary object until initialization completes
module.exports = {
  createServer: (...args) => {
    console.warn('NexureJS is still initializing in CommonJS compatibility mode. Your code might execute before initialization completes.');

    // Return a proxy that will wait for the real implementation
    return new Proxy({}, {
      get: (target, prop) => {
        throw new Error('NexureJS is not yet initialized in CommonJS mode. Consider using await import() instead of require().');
      }
    });
  },

  // Indicate that this is the compatibility layer (for debugging)
  isCompatibilityLayer: true
};
