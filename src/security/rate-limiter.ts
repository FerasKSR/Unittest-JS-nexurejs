/**
 * Rate limiting middleware for abuse prevention
 */

import { IncomingMessage, ServerResponse } from 'node:http';
import { MiddlewareHandler } from '../middleware/middleware.js';
import { HttpException } from '../http/http-exception.js';

/**
 * Rate limiter options
 */
export interface RateLimiterOptions {
  /**
   * Maximum number of requests allowed in the window
   * @default 100
   */
  max?: number;

  /**
   * Time window in milliseconds
   * @default 60000 (1 minute)
   */
  windowMs?: number;

  /**
   * Whether to add rate limit headers to the response
   * @default true
   */
  headers?: boolean;

  /**
   * Function to generate a key for the request
   * @default IP address
   */
  keyGenerator?: (req: IncomingMessage) => string;

  /**
   * Function to skip rate limiting for certain requests
   * @default false
   */
  skip?: (req: IncomingMessage) => boolean;

  /**
   * Status code to use when rate limit is exceeded
   * @default 429
   */
  statusCode?: number;

  /**
   * Message to use when rate limit is exceeded
   * @default 'Too many requests, please try again later.'
   */
  message?: string;

  /**
   * Header names
   */
  headerNames?: {
    /**
     * Header for remaining requests
     * @default 'X-RateLimit-Remaining'
     */
    remaining?: string;

    /**
     * Header for rate limit
     * @default 'X-RateLimit-Limit'
     */
    limit?: string;

    /**
     * Header for reset time
     * @default 'X-RateLimit-Reset'
     */
    reset?: string;
  };
}

/**
 * In-memory store for rate limiting
 */
class MemoryStore {
  private hits = new Map<string, { count: number, resetTime: number }>();

  /**
   * Increment the hit count for a key
   * @param key The key to increment
   * @param windowMs The time window in milliseconds
   */
  async increment(key: string, windowMs: number): Promise<{ count: number, resetTime: number }> {
    const now = Date.now();
    const record = this.hits.get(key);

    if (!record || record.resetTime <= now) {
      // Create a new record
      const resetTime = now + windowMs;
      const newRecord = { count: 1, resetTime };
      this.hits.set(key, newRecord);
      return newRecord;
    }

    // Increment existing record
    record.count += 1;
    return record;
  }

  /**
   * Get the hit count for a key
   * @param key The key to get
   */
  async get(key: string): Promise<{ count: number, resetTime: number } | undefined> {
    return this.hits.get(key);
  }

  /**
   * Reset the hit count for a key
   * @param key The key to reset
   */
  async reset(key: string): Promise<void> {
    this.hits.delete(key);
  }

  /**
   * Clean up expired records
   */
  cleanup(): void {
    const now = Date.now();

    for (const [key, record] of this.hits.entries()) {
      if (record.resetTime <= now) {
        this.hits.delete(key);
      }
    }
  }
}

/**
 * Rate limiter store interface
 */
export interface RateLimiterStore {
  /**
   * Increment the hit count for a key
   * @param key The key to increment
   * @param windowMs The time window in milliseconds
   */
  increment(key: string, windowMs: number): Promise<{ count: number, resetTime: number }>;

  /**
   * Get the hit count for a key
   * @param key The key to get
   */
  get(key: string): Promise<{ count: number, resetTime: number } | undefined>;

  /**
   * Reset the hit count for a key
   * @param key The key to reset
   */
  reset(key: string): Promise<void>;
}

/**
 * Create rate limiting middleware
 * @param options Rate limiter options
 * @param store Rate limiter store
 */
export function createRateLimiterMiddleware(
  options: RateLimiterOptions = {},
  store?: RateLimiterStore
): MiddlewareHandler {
  // Set default options
  const max = options.max || 100;
  const windowMs = options.windowMs || 60000;
  const headers = options.headers !== false;
  const statusCode = options.statusCode || 429;
  const message = options.message || 'Too many requests, please try again later.';

  // Set default header names
  const headerNames = options.headerNames || {};
  const remainingHeader = headerNames.remaining || 'X-RateLimit-Remaining';
  const limitHeader = headerNames.limit || 'X-RateLimit-Limit';
  const resetHeader = headerNames.reset || 'X-RateLimit-Reset';

  // Set default key generator
  const keyGenerator = options.keyGenerator || ((req: IncomingMessage) => {
    return req.socket.remoteAddress || 'unknown';
  });

  // Set default skip function
  const skip = options.skip || (() => false);

  // Use provided store or create a memory store
  const limiterStore = store || new MemoryStore();

  // Start cleanup interval for memory store
  if (limiterStore instanceof MemoryStore) {
    setInterval(() => {
      limiterStore.cleanup();
    }, 60000);
  }

  return async (req: IncomingMessage, res: ServerResponse, next: () => Promise<void>) => {
    // Skip rate limiting if skip function returns true
    if (skip(req)) {
      return next();
    }

    // Generate key for the request
    const key = keyGenerator(req);

    // Increment hit count
    const result = await limiterStore.increment(key, windowMs);

    // Calculate remaining requests
    const remaining = Math.max(0, max - result.count);

    // Calculate reset time
    const resetTime = Math.ceil(result.resetTime / 1000);

    // Set rate limit headers
    if (headers) {
      res.setHeader(remainingHeader, remaining.toString());
      res.setHeader(limitHeader, max.toString());
      res.setHeader(resetHeader, resetTime.toString());
    }

    // Check if rate limit is exceeded
    if (result.count > max) {
      throw new HttpException(statusCode, message, {
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
      });
    }

    await next();
  };
}

/**
 * Create a Redis store for rate limiting
 * @param redisClient Redis client
 * @param prefix Key prefix for Redis
 */
export function createRedisStore(redisClient: any, prefix: string = 'ratelimit:'): RateLimiterStore {
  return {
    async increment(key: string, windowMs: number): Promise<{ count: number, resetTime: number }> {
      const redisKey = `${prefix}${key}`;
      const now = Date.now();
      const resetTime = now + windowMs;

      // Use Redis pipeline for atomic operations
      const pipeline = redisClient.pipeline();

      // Increment counter
      pipeline.incr(redisKey);

      // Set expiration if not already set
      pipeline.pexpire(redisKey, windowMs);

      // Get TTL
      pipeline.pttl(redisKey);

      // Execute pipeline
      const results = await pipeline.exec();

      // Get count and TTL
      const count = results[0][1];
      const ttl = results[2][1];

      // Calculate reset time
      const calculatedResetTime = ttl > 0 ? now + ttl : resetTime;

      return { count, resetTime: calculatedResetTime };
    },

    async get(key: string): Promise<{ count: number, resetTime: number } | undefined> {
      const redisKey = `${prefix}${key}`;
      const now = Date.now();

      // Use Redis pipeline for atomic operations
      const pipeline = redisClient.pipeline();

      // Get counter
      pipeline.get(redisKey);

      // Get TTL
      pipeline.pttl(redisKey);

      // Execute pipeline
      const results = await pipeline.exec();

      // Get count and TTL
      const count = parseInt(results[0][1] || '0', 10);
      const ttl = results[1][1];

      if (ttl <= 0) {
        return undefined;
      }

      // Calculate reset time
      const resetTime = now + ttl;

      return { count, resetTime };
    },

    async reset(key: string): Promise<void> {
      const redisKey = `${prefix}${key}`;
      await redisClient.del(redisKey);
    }
  };
}
