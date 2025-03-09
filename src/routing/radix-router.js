/**
 * Standard Radix Router
 *
 * A radix tree implementation for route matching.
 */

export class RadixRouter {
  constructor(prefix = '') {
    this.prefix = prefix;
    this.routes = new Map();
  }

  /**
   * Add a route to the router
   * @param {string} method HTTP method
   * @param {string} path Route path
   * @param {Function} handler Route handler
   */
  add(method, path, handler) {
    const key = `${method}:${path}`;
    this.routes.set(key, handler);
    return this;
  }

  /**
   * Register a route (alias for add)
   * @param {string} method HTTP method
   * @param {string} path Route path
   * @param {Function} handler Route handler
   */
  register(method, path, handler) {
    return this.add(method, path, handler);
  }

  /**
   * Add a route (alias for add)
   * @param {string} method HTTP method
   * @param {string} path Route path
   * @param {Function} handler Route handler
   */
  addRoute(method, path, handler) {
    return this.add(method, path, handler);
  }

  /**
   * Look up a route
   * @param {string} method HTTP method
   * @param {string} path Route path
   * @returns {Object|null} Route match or null if not found
   */
  lookup(method, path) {
    const key = `${method}:${path}`;

    // Check for exact match
    if (this.routes.has(key)) {
      const handler = this.routes.get(key);
      return { handler, params: {} };
    }

    // Check for parameterized routes
    for (const [routeKey, handler] of this.routes.entries()) {
      const [routeMethod, routePath] = routeKey.split(':');

      if (routeMethod !== method) continue;

      const params = this.matchPath(routePath, path);
      if (params) {
        return { handler, params };
      }
    }

    return null;
  }

  /**
   * Match a route (alias for lookup)
   * @param {string} method HTTP method
   * @param {string} path Route path
   * @returns {Object|null} Route match or null if not found
   */
  match(method, path) {
    return this.lookup(method, path);
  }

  /**
   * Find a route (alias for lookup)
   * @param {string} method HTTP method
   * @param {string} path Route path
   * @returns {Object|null} Route match or null if not found
   */
  find(method, path) {
    return this.lookup(method, path);
  }

  /**
   * Match a path against a route pattern
   * @param {string} pattern Route pattern
   * @param {string} path Path to match
   * @returns {Object|null} Parameters or null if no match
   */
  matchPath(pattern, path) {
    // Convert route pattern to regex
    const paramNames = [];
    let regexPattern = pattern
      .replace(/\/+$/, '')  // Remove trailing slashes
      .replace(/\/:([^\/]+)/g, (_, paramName) => {
        paramNames.push(paramName);
        return '/([^/]+)';
      })
      .replace(/\*/g, '.*');

    // Add start and end anchors
    regexPattern = `^${regexPattern}/?$`;

    const regex = new RegExp(regexPattern);
    const match = path.match(regex);

    if (!match) return null;

    // Extract parameters
    const params = {};
    for (let i = 0; i < paramNames.length; i++) {
      params[paramNames[i]] = match[i + 1];
    }

    return params;
  }
}
