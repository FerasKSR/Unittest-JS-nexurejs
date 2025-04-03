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

/**
 * NexureJS Main Module
 *
 * This module loads either the native C++ bindings or falls back to pure JavaScript
 * implementations if there are issues with the native modules.
 */

import * as safeImpl from './safe-wrapper.js.js';
import { flags, displayHelp, displayVersion } from './cli-flags.js';

// Process flags
if (flags.help) {
  displayHelp();
  process.exit(0);
}

// First try to load the native modules
let nativeImpl: typeof safeImpl | null = null;
let usingNative = false;

// Skip native loading if forceJs is true
if (!flags.forceJs) {
  try {
    // Attempt to load native modules
    const nativeModule = await import('./native');
    nativeImpl = nativeModule.default || nativeModule;

    // Verify that the native module is working by calling a simple function
    if (nativeImpl && !nativeImpl.isAvailable()) {
      throw new Error('Native module reports it is not available');
    }

    usingNative = true;
    if (flags.verbose) {
      console.log(`Using native implementation (v${nativeImpl?.version})`);
    }
  } catch (err) {
    if (flags.verbose) {
      console.warn(`Failed to load native modules, falling back to JavaScript implementation: ${err instanceof Error ? err.message : String(err)}`);
    }
    nativeImpl = null;
    usingNative = false;
  }
} else if (flags.verbose) {
  console.log('Forced JavaScript implementation via --force-js flag');
}

// Process version flag
if (flags.version) {
  displayVersion(usingNative && nativeImpl ? nativeImpl.version : safeImpl.version);
  process.exit(0);
}

// Export all the modules, using native if available or falling back to JS
export const HttpParser = usingNative ? nativeImpl!.HttpParser : safeImpl.HttpParser;
export const ObjectPool = usingNative ? nativeImpl!.ObjectPool : safeImpl.ObjectPool;
export const RadixRouter = usingNative ? nativeImpl!.RadixRouter : safeImpl.RadixRouter;
export const JsonProcessor = usingNative ? nativeImpl!.JsonProcessor : safeImpl.JsonProcessor;
export const WebSocketServer = usingNative ? nativeImpl!.WebSocketServer : safeImpl.WebSocketServer;

// URL parsing functions
export const parseUrl = usingNative ? nativeImpl!.parseUrl : safeImpl.parseUrl;
export const parseQueryString = usingNative ? nativeImpl!.parseQueryString : safeImpl.parseQueryString;
export const formatUrl = usingNative ? nativeImpl!.formatUrl : safeImpl.formatUrl;
export const formatQueryString = usingNative ? nativeImpl!.formatQueryString : safeImpl.formatQueryString;

// Schema validation functions
export const validate = usingNative ? nativeImpl!.validate : safeImpl.validate;
export const validatePartial = usingNative ? nativeImpl!.validatePartial : safeImpl.validatePartial;
export const compileSchema = usingNative ? nativeImpl!.compileSchema : safeImpl.compileSchema;
export const clearCache = usingNative ? nativeImpl!.clearCache : safeImpl.clearCache;
export const getCacheStats = usingNative ? nativeImpl!.getCacheStats : safeImpl.getCacheStats;

// Compression functions
export const compress = usingNative ? nativeImpl!.compress : safeImpl.compress;
export const decompress = usingNative ? nativeImpl!.decompress : safeImpl.decompress;

// Module metadata
export const version = usingNative ? nativeImpl!.version : safeImpl.version;
export const isNative = usingNative;

// Function to check if native modules are available
export function isNativeAvailable(): boolean {
  return usingNative;
}

// Function to force JavaScript fallback (for testing)
export function forceJavaScriptFallback(): void {
  if (usingNative) {
    console.log('Forcing JavaScript fallback (native modules will be ignored)');
    usingNative = false;

    // Re-export all modules using JavaScript implementation
    module.exports = {
      ...safeImpl,
      isNative: false,
      isNativeAvailable: (): boolean => false,
      forceJavaScriptFallback: (): void => void 0,
      forceNativeImplementation: forceNativeImplementation
    };
  }
}

// Function to force native implementation (if available)
export function forceNativeImplementation(): boolean {
  if (!usingNative && nativeImpl) {
    try {
      // Verify that the native module is working
      if (!nativeImpl.isAvailable()) {
        return false;
      }

      console.log(`Switching to native implementation (v${nativeImpl.version})`);
      usingNative = true;

      // Re-export all modules using native implementation
      module.exports = {
        ...nativeImpl,
        isNative: true,
        isNativeAvailable: (): boolean => true,
        forceJavaScriptFallback: forceJavaScriptFallback,
        forceNativeImplementation: (): boolean => true
      };

      return true;
    } catch (err) {
      console.warn(`Failed to force native implementation: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  return usingNative;
}
