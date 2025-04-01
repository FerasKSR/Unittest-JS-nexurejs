/**
 * Nexure.js API
 *
 * Main exports for the Nexure.js framework
 */

// Application startup message
console.log('🚀 Nexure.js started - High-performance Node.js framework');

// Core exports
export { Nexure } from './core/nexure.js';
export { Router } from './routing/router.js';
export { Container, Scope } from './di/container.js';

// HTTP utilities
export * from './http/constants.js';
export * from './http/body-parser.js';
export * from './http/http-utils.js';
export * from './http/http-method.js';
export * from './http/http-exception.js';

// Validation
export * from './validation/index.js';

// Serialization
export * from './serialization/index.js';

// Core utilities
export { logger, LogLevel } from './utils/logger.js';
export { crypto } from './utils/crypto-service.js';
export { globalPool as bufferPool } from './utils/buffer-pool.js';
export {
  readFileContents,
  readTextFile,
  writeFileContents,
  writeTextFile,
  ensureDirectory,
  getFileMetadata,
  fileExists,
  copyFile,
  streamFile,
  getTempDirectory,
  getTempFilePath,
  saveStreamToFile,
  deleteFile,
  getMimeType,
  type FileOptions,
  type FileMetadata
} from './utils/file-utils.js';

// Error handling
export {
  HttpError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  MethodNotAllowedError,
  NotAcceptableError,
  ConflictError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
  UnprocessableEntityError,
  TooManyRequestsError,
  InternalServerError,
  NotImplementedError,
  ServiceUnavailableError,
  createHttpError,
  isHttpError,
  toHttpError
} from './errors/http-errors.js';

// Middleware
export * from './middleware/middleware.js';
export {
  createStreamMiddleware,
  stream,
  streamToBuffer,
  BufferCollector,
  type StreamOptions,
  type StreamResult
} from './middleware/stream-middleware.js';
export {
  errorHandler,
  developmentErrorHandler,
  createErrorHandler
} from './middleware/error-handler.js';

// Decorators
export * from './decorators/route-decorators.js';
export * from './decorators/injection-decorators.js';
