/**
 * Global type declarations
 *
 * This file provides global type definitions for the application.
 */

declare module 'http-methods' {
  interface HttpMethods {
    GET: string;
    POST: string;
    PUT: string;
    DELETE: string;
    PATCH: string;
    HEAD: string;
    OPTIONS: string;
    TRACE: string;
  }
  const methods: HttpMethods;
  export = methods;
}

import {
  CacheOptions,
  CacheManager,
  Logger,
  Container,
  Router,
  HttpException,
  HttpMethod,
  HTTP_CONSTANTS,
  HTTP_LIMITS,
  OptimizedTransform,
  Transform,
  TimeoutHandler,
  WebSocketServer,
  WebSocketServerOptions,
  isWebSocketController,
  getWebSocketHandlers,
  getWebSocketAuthHandler,
  JsHttpParser,
  JsRadixRouter,
  NativeJsonProcessor,
  NativeSchemaValidator,
  ZeroCopyResult,
  ZeroCopyHttpParser,
  getParser,
  releaseParser,
  parseHttpRequest,
  ObjectPool,
  MultipartParser,
  Validator,
  ValidationSchema,
  ValidationResult,
  ValidationOptions,
  Scope,
  getInjectionMetadata,
  getUseNativeByDefault,
  getNativeModuleMetrics
} from './index';

// Make these types available globally
declare global {
  // Re-export all types as global
  export {
    CacheOptions,
    CacheManager,
    Logger,
    Container,
    Router,
    HttpException,
    HttpMethod,
    HTTP_CONSTANTS,
    HTTP_LIMITS,
    OptimizedTransform,
    Transform,
    TimeoutHandler,
    WebSocketServer,
    WebSocketServerOptions,
    isWebSocketController,
    getWebSocketHandlers,
    getWebSocketAuthHandler,
    JsHttpParser,
    JsRadixRouter,
    NativeJsonProcessor,
    NativeSchemaValidator,
    ZeroCopyResult,
    ZeroCopyHttpParser,
    getParser,
    releaseParser,
    parseHttpRequest,
    ObjectPool,
    MultipartParser,
    Validator,
    ValidationSchema,
    ValidationResult,
    ValidationOptions,
    Scope,
    getInjectionMetadata,
    getUseNativeByDefault,
    getNativeModuleMetrics
  };

  // Define any additional global types
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      PORT?: string;
    }
  }

  interface Dictionary<T> {
    [key: string]: T;
  }
}

declare interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  log(message: string, ...args: any[]): void;
}

declare const logger: Logger;

declare enum LogLevel {
  DEBUG,
  INFO,
  WARN,
  ERROR
}

declare interface MiddlewareHandler {
  (req: any, res: any, next: any): Promise<void> | void;
}

declare interface RouterMatch {
  params: Record<string, string>;
  handler: (req: any, res: any) => Promise<void> | void;
  middlewares: MiddlewareHandler[];
}

declare interface Container {
  get(target: any): any;
  register(target: any, implementation: any): void;
}

declare interface ValidationSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  [key: string]: any;
}

declare interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
}

declare interface ValidationError {
  path: string;
  message: string;
}

declare interface Validator {
  validate(data: any, schema: ValidationSchema): ValidationResult;
  new (): Validator;
}

declare interface BufferPool {
  acquire(size: number): Buffer;
  release(buffer: Buffer): void;
}

declare const globalPool: BufferPool;

// Native module declarations
declare interface NativeJsonProcessor {
  new (): NativeJsonProcessor;
  parse(data: string): any;
  stringify(data: any): string;
}

declare interface NativeSchemaValidator {
  new (): NativeSchemaValidator;
  validate(data: any, schema: ValidationSchema): ValidationResult;
}

declare interface OptimizedTransform {
  (chunk: any): any;
}

// Functions
declare function parseBody(req: any): Promise<any>;
declare function composeMiddleware(middlewares: MiddlewareHandler[]): MiddlewareHandler;
declare function getRouteMetadata(target: any, propertyKey?: string): any;
declare function hasBody(req: any): boolean;
declare function getContentType(req: any): string;
declare function createOptimizedTransform(options: any): OptimizedTransform;
declare function createJsonTransformer(options: any): OptimizedTransform;
declare function createTextTransformer(options: any): OptimizedTransform;
declare function setUseNativeByDefault(enable: boolean): void;
declare function configureNativeModules(options: any): void;
declare function getNativeModuleStatus(): any;
declare function extractBoundary(contentType: string): string;
declare function getTempFilePath(prefix: string, suffix: string): Promise<string>;
declare function ensureDirectory(dir: string): Promise<void>;
declare function fileExists(path: string): Promise<boolean>;
declare function deleteFile(path: string): Promise<void>;

// For native modules
declare const v8Optimizer: {
  optimizeFunction(fn: Function): Function;
};

declare interface TimeoutHandler {
  setTimeout(timeout: number): void;
  clearTimeout(): void;
}

declare const globalTimeoutManager: {
  createTimeoutHandler(options: any): TimeoutHandler;
};

declare interface JsHttpParser {
  new (): JsHttpParser;
  parse(buffer: Buffer): any;
}

declare interface JsRadixRouter {
  new (basePath: string): JsRadixRouter;
  addRoute(method: HttpMethod, path: string, handler: any): void;
  findRoute(method: HttpMethod, path: string): any;
}

// Extend crypto
interface Crypto {
  randomString(length: number): string;
}
