export { Nexure, type NexureOptions } from './core/nexure';
export { HttpsServerAdapter, type HttpsServerOptions } from './core/https-server';
export { HttpMethod } from './http/http-method';
export { HttpException } from './http/http-exception';
export { parseBody } from './http/body-parser';
export { Http2ServerAdapter, type Http2ServerOptions } from './http/http2-server';
export { Router } from './routing/router';
export {
  type MiddlewareHandler,
  Middleware,
  createMiddleware,
  composeMiddleware
} from './middleware/middleware';
export {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Head,
  Options,
  All,
  Use,
  Status,
  type RouteMetadata
} from './decorators/route-decorators';
export {
  Injectable,
  Inject,
  InjectProperty,
  type InjectionMetadata
} from './decorators/injection-decorators';
export { Container, Scope, type ProviderOptions } from './di/container';
export { Logger, LogLevel, type LoggerOptions } from './utils/logger';
export {
  BindingType,
  tryLoadNativeBinding,
  hasNativeBinding,
  getNativeBinding,
  fastJsonParse,
  fastJsonStringify,
  initNativeBindings,
  getUseNativeByDefault,
  setUseNativeByDefault
} from './utils/native-bindings';
export {
  PerformanceMonitor,
  type PerformanceMetric,
  type PerformanceMonitorOptions
} from './utils/performance-monitor';
export { Env, type EnvOptions } from './utils/env';
export {
  CacheManager,
  MemoryCacheStore,
  type CacheStore,
  type CacheOptions
} from './cache/cache-manager';
export {
  createCacheMiddleware,
  createCacheControlMiddleware,
  type HttpCacheOptions
} from './cache/cache-middleware';
export {
  WorkerPool,
  type WorkerTask,
  type WorkerResult,
  type WorkerPoolOptions
} from './concurrency/worker-pool';

export {
  ClusterManager,
  type ClusterManagerOptions,
  type ClusterManagerEvents
} from './concurrency/cluster-manager';
export {
  Validator,
  type ValidationRule,
  type ValidationError,
  type ValidationResult,
  type ValidationSchema,
  type ValidatorFunction,
  type SanitizerFunction
} from './validation/validator';
export {
  validateBody,
  validateQuery,
  validateParams,
  type ValidationOptions
} from './validation/validation-middleware';
export {
  createSecurityHeadersMiddleware,
  type SecurityHeadersOptions
} from './security/security-headers';
export {
  CsrfTokenGenerator,
  createCsrfMiddleware,
  createCsrfTokenMiddleware,
  type CsrfOptions
} from './security/csrf';
export {
  createRateLimiterMiddleware,
  createRedisStore,
  type RateLimiterOptions,
  type TokenBucketStore
} from './security/rate-limiter';

// Export routing module
export * from './routing/index';
export * from './http/index';

// Export setup utility
export { initializeFramework, type SetupOptions } from './setup';

// Version
export const VERSION = '0.2.0';

/**
 * Create a new Nexure server
 *
 * @param options Server options
 * @returns A configured Nexure server instance
 */
export function createServer(options = {}): import('./core/nexure').Nexure {
  // Import directly from the module to avoid circular dependency
  // (This works in both ESM and CJS)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Nexure } = require('./core/nexure');
  return new Nexure(options);
}

// Auto-initialize the framework with native modules enabled by default
import './setup';
