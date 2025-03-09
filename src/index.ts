// Core
export { Nexure, type NexureOptions } from './core/nexure.js';
export { HttpsServerAdapter, type HttpsServerOptions } from './core/https-server.js';

// HTTP
export { HttpMethod } from './http/http-method.js';
export { HttpException } from './http/http-exception.js';
export { parseBody } from './http/body-parser.js';
export { Http2ServerAdapter, type Http2ServerOptions } from './http/http2-server.js';

// Middleware
export {
  type MiddlewareHandler,
  Middleware,
  createMiddleware,
  composeMiddleware
} from './middleware/middleware.js';

// Routing
export { Router } from './routing/router.js';

// Decorators
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
} from './decorators/route-decorators.js';

export {
  Injectable,
  Inject,
  InjectProperty,
  type InjectionMetadata
} from './decorators/injection-decorators.js';

// Dependency Injection
export {
  Container,
  Scope,
  type ProviderOptions
} from './di/container.js';

// Utils
export {
  Logger,
  LogLevel,
  type LoggerOptions
} from './utils/logger.js';

export {
  BindingType,
  tryLoadNativeBinding,
  hasNativeBinding,
  getNativeBinding,
  fastJsonParse,
  fastJsonStringify,
  initNativeBindings
} from './utils/native-bindings.js';

export {
  PerformanceMonitor,
  type PerformanceMetric,
  type PerformanceMonitorOptions
} from './utils/performance-monitor.js';

export {
  Env,
  type EnvOptions
} from './utils/env.js';

// Cache
export {
  CacheManager,
  MemoryCacheStore,
  type CacheStore,
  type CacheOptions
} from './cache/cache-manager.js';

export {
  createCacheMiddleware,
  createCacheControlMiddleware,
  type HttpCacheOptions
} from './cache/cache-middleware.js';

// Concurrency
export {
  WorkerPool,
  type WorkerTask,
  type WorkerResult,
  type WorkerPoolOptions
} from './concurrency/worker-pool.js';

export {
  ClusterManager,
  type ClusterManagerOptions,
  type ClusterManagerEvents
} from './concurrency/cluster-manager.js';

// Validation
export {
  Validator,
  type ValidationRule,
  type ValidationError,
  type ValidationResult,
  type ValidationSchema,
  type ValidatorFunction,
  type SanitizerFunction
} from './validation/validator.js';

export {
  validateBody,
  validateQuery,
  validateParams,
  type ValidationOptions
} from './validation/validation-middleware.js';

// Security
export {
  createSecurityHeadersMiddleware,
  type SecurityHeadersOptions
} from './security/security-headers.js';

export {
  CsrfTokenGenerator,
  createCsrfMiddleware,
  createCsrfTokenMiddleware,
  type CsrfOptions
} from './security/csrf.js';

export {
  createRateLimiterMiddleware,
  createRedisStore,
  type RateLimiterOptions,
  type RateLimiterStore
} from './security/rate-limiter.js';

// Version
export const VERSION = '0.1.0';
