/**
 * NexureJS Native Module
 *
 * This module provides high-performance C++ implementations of core components.
 */

import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { URL, URLSearchParams } from 'node:url';
import { Server as HttpServer } from 'node:http';
import { EventEmitter } from 'node:events';
import { JsHttpParser } from '../http/http-parser.js';
import { HttpMethod } from '../http/http-method.js';
import { Logger } from '../utils/logger.js';
import type { HttpParseResult, NativeHttpParser } from '../types/native.js';
import { RadixRouter as JsRadixRouter } from '../routing/radix-router.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configuration options for native modules
 */
export interface NativeModuleOptions {
  /** Whether native modules are enabled (default: true) */
  enabled?: boolean;
  /** Whether to log verbose information (default: false) */
  verbose?: boolean;
  /** Path to the native module (default: auto-detected) */
  modulePath?: string;
  /** Maximum size for route cache (default: 1000) */
  maxCacheSize?: number;
}

// Define WebSocket connection interface
export interface WebSocketConnection {
  id: number;
  send(message: string | object): void;
  sendBinary(data: Buffer): void;
  close(code?: number, reason?: string): void;
  joinRoom(roomName: string): void;
  leaveRoom(roomName: string): void;
  leaveAllRooms(): void;
  isInRoom(roomName: string): boolean;
  getRooms(): string[];
  isAlive: boolean;
  isAuthenticated: boolean;
  user?: any;
  data: Record<string, any>;
  lastHeartbeat: number;
  ping(): void;
}

// Define WebSocket message interface
export interface WebSocketMessage {
  type: string;
  data: any;
  room?: string;
}

// Define authentication options
export interface WebSocketAuthOptions {
  /** Whether authentication is required (default: false) */
  required: boolean;

  /** Timeout in milliseconds to authenticate after connection (default: 10000) */
  timeout: number;

  /** Authentication handler function */
  handler: (token: string, connection: WebSocketConnection) => Promise<any>;
}

// Define heartbeat options
export interface WebSocketHeartbeatOptions {
  /** Whether to enable heartbeat (default: true) */
  enabled: boolean;

  /** Interval in milliseconds to send ping messages (default: 30000) */
  interval: number;

  /** Timeout in milliseconds to wait for pong response (default: 10000) */
  timeout: number;
}

// Define WebSocket server options
export interface WebSocketServerOptions {
  /** Authentication options */
  auth?: Partial<WebSocketAuthOptions>;

  /** Heartbeat options */
  heartbeat?: Partial<WebSocketHeartbeatOptions>;

  /** Maximum connections allowed (0 = unlimited, default: 0) */
  maxConnections?: number;

  /** Maximum clients per room (0 = unlimited, default: 0) */
  maxClientsPerRoom?: number;
}

// Define WebSocket event context
export interface WebSocketEventContext {
  connection: WebSocketConnection;
  message?: WebSocketMessage;
  room?: string;
  binary?: Buffer;
}

/**
 * WebSocket connection statistics interface
 */
export interface WebSocketConnectionStats {
  /** Total number of connections */
  totalConnections: number;

  /** Number of authenticated connections */
  authenticatedConnections: number;

  /** Total bytes sent */
  totalBytesSent: number;

  /** Total bytes received */
  totalBytesReceived: number;

  /** Number of rooms */
  roomCount: number;
}

/**
 * Status of native module components
 */
export interface NativeModuleStatus {
  /** Whether the native module is loaded */
  loaded: boolean;
  /** Whether the HTTP parser is available */
  httpParser: boolean;
  /** Whether the radix router is available */
  radixRouter: boolean;
  /** Whether the JSON processor is available */
  jsonProcessor: boolean;
  /** Whether the URL parser is available */
  urlParser: boolean;
  /** Whether the schema validator is available */
  schemaValidator: boolean;
  /** Whether the compression module is available */
  compression: boolean;
  /** Whether the WebSocket module is available */
  webSocket: boolean;
  /** Error message if loading failed */
  error?: string;
}

// Track native binding and loading status
let nativeBinding: any = null;
let nativeBindingAttempted = false;
let nativeBindingError: string | null = null;

// Default native module status
const nativeModuleStatus: NativeModuleStatus = {
  loaded: false,
  httpParser: false,
  radixRouter: false,
  jsonProcessor: false,
  urlParser: false,
  schemaValidator: false,
  compression: false,
  webSocket: false
};

// Default configuration
let nativeOptions: NativeModuleOptions = {
  enabled: true,
  verbose: false,
  maxCacheSize: 1000
};

/**
 * Configure native module options
 * @param options Configuration options
 * @returns Current configuration
 */
export function configureNativeModules(options: NativeModuleOptions): NativeModuleOptions {
  nativeOptions = { ...nativeOptions, ...options };

  // Reset loading state if options change
  if (nativeBindingAttempted) {
    nativeBindingAttempted = false;
    nativeBinding = null;
    nativeModuleStatus.loaded = false;
    nativeModuleStatus.httpParser = false;
    nativeModuleStatus.radixRouter = false;
    nativeModuleStatus.jsonProcessor = false;
    nativeModuleStatus.urlParser = false;
    nativeModuleStatus.schemaValidator = false;
    nativeModuleStatus.compression = false;
    nativeModuleStatus.webSocket = false;
  }

  return nativeOptions;
}

/**
 * Get the status of native module components
 * @returns Status object
 */
export function getNativeModuleStatus(): NativeModuleStatus {
  // Ensure native module is loaded
  loadNativeBinding();
  return {
    loaded: nativeBinding !== null,
    httpParser: nativeBinding?.HttpParser !== undefined,
    radixRouter: nativeBinding?.RadixRouter !== undefined,
    jsonProcessor: nativeBinding?.JsonProcessor !== undefined,
    urlParser: nativeBinding?.UrlParser !== undefined,
    schemaValidator: nativeBinding?.SchemaValidator !== undefined,
    compression: nativeBinding?.Compression !== undefined,
    webSocket: nativeBinding?.NativeWebSocketServer !== undefined,
    error: nativeBindingError || undefined
  };
}

/**
 * Load the native module
 * @returns The native module or null if not available
 */
export function loadNativeBinding(): any {
  // Return cached result if already attempted
  if (nativeBindingAttempted) return nativeBinding;

  nativeBindingAttempted = true;

  // Skip if disabled
  if (!nativeOptions.enabled) {
    if (nativeOptions.verbose) {
      console.log('Native modules disabled by configuration');
    }
    nativeModuleStatus.error = 'Disabled by configuration';
    return null;
  }

  try {
    // Try to load the native module from multiple possible locations
    const possiblePaths = [
      // Custom path from options
      nativeOptions.modulePath,
      // Local build path
      join(__dirname, '..', '..', '..', 'build', 'Release', 'nexurejs_native.node'),
      // Prebuilt binary paths based on platform
      join(__dirname, '..', '..', '..', 'prebuilds', `${process.platform}-${process.arch}`, 'nexurejs_native.node'),
      // Node modules path for platform-specific packages
      require.resolve(`nexurejs-native-${process.platform}-${process.arch}`)
    ].filter(Boolean) as string[];

    let loadError: Error | null = null;

    // Try each path until one works
    for (const bindingPath of possiblePaths) {
      try {
        if (existsSync(bindingPath)) {
          // Load the native module
          nativeBinding = require(bindingPath);

          // Update status
          nativeModuleStatus.loaded = true;
          nativeModuleStatus.httpParser = !!nativeBinding.HttpParser;
          nativeModuleStatus.radixRouter = !!nativeBinding.RadixRouter;
          nativeModuleStatus.jsonProcessor = !!nativeBinding.JsonProcessor;
          nativeModuleStatus.urlParser = !!nativeBinding.parse;
          nativeModuleStatus.schemaValidator = !!nativeBinding.validate;
          nativeModuleStatus.compression = !!nativeBinding.compress;
          nativeModuleStatus.webSocket = !!nativeBinding.WebSocketServer;

          if (nativeOptions.verbose) {
            console.log(`Native module loaded successfully from ${bindingPath}`);
            console.log(`Available native components: ${Object.keys(nativeBinding).join(', ')}`);
          }

          // Successfully loaded
          return nativeBinding;
        }
      } catch (err: any) {
        // Store the error but continue trying other paths
        loadError = err;
      }
    }

    // If we get here, all paths failed
    throw loadError || new Error('Failed to load native module from any location');
  } catch (err: any) {
    if (nativeOptions.verbose || process.env.NODE_ENV !== 'production') {
      console.warn(`Failed to load native module: ${err.message}`);

      if (err.code === 'MODULE_NOT_FOUND') {
        console.warn('Native module not built. Run "npm run build:native:test" to build it.');
      } else if (err.code === 'ENOENT') {
        console.warn('Native module file not found. Check build configuration.');
      } else {
        console.warn(`Error type: ${err.code || 'Unknown'}`);
      }

      console.warn('Using JavaScript fallbacks instead');
    }

    nativeModuleStatus.error = err.message;
    nativeBinding = null;
  }

  return nativeBinding;
}

/**
 * HTTP Parser class that automatically chooses between native and JS implementations
 */
export class HttpParser implements NativeHttpParser {
  private parser: any;
  private useNative: boolean;
  private jsParser: JsHttpParser | null = null;

  // Performance metrics
  private static jsParseTime = 0;
  private static jsParseCount = 0;
  private static nativeParseTime = 0;
  private static nativeParseCount = 0;

  constructor() {
    const nativeModule = loadNativeBinding();
    this.useNative = !!(nativeModule?.HttpParser && nativeOptions.enabled);

    if (this.useNative) {
      try {
        this.parser = new nativeModule.HttpParser();
      } catch (err: any) {
        if (nativeOptions.verbose) {
          console.warn(`Failed to create native HTTP parser: ${err.message}`);
        }
        this.useNative = false;
      }
    }

    if (!this.useNative) {
      // Use JavaScript fallback
      this.jsParser = new JsHttpParser();
    }
  }

  /**
   * Parse an HTTP request
   * @param buffer The HTTP request buffer
   * @returns Parsed HTTP request
   */
  parse(buffer: Buffer): HttpParseResult {
    const start = performance.now();
    let result: HttpParseResult;

    if (this.useNative && this.parser) {
      result = this.parser.parse(buffer);
      HttpParser.nativeParseTime += performance.now() - start;
      HttpParser.nativeParseCount++;
    } else if (this.jsParser) {
      result = this.jsParser.parse(buffer);
      HttpParser.jsParseTime += performance.now() - start;
      HttpParser.jsParseCount++;
    } else {
      throw new Error('No HTTP parser implementation available');
    }

    return result;
  }

  /**
   * Parse HTTP headers from a buffer
   * @param buffer Buffer containing HTTP headers
   * @returns Parsed headers
   */
  parseHeaders(buffer: Buffer): Record<string, string> {
    if (this.useNative && this.parser) {
      return this.parser.parseHeaders(buffer);
    } else if (this.jsParser) {
      return this.jsParser.parseHeaders(buffer);
    }
    throw new Error('No HTTP parser implementation available');
  }

  /**
   * Parse HTTP body from a buffer
   * @param buffer Buffer containing HTTP body
   * @param contentLength Expected content length
   * @returns Parsed body
   */
  parseBody(buffer: Buffer, contentLength: number): Buffer {
    if (this.useNative && this.parser) {
      return this.parser.parseBody(buffer, contentLength);
    } else if (this.jsParser) {
      return this.jsParser.parseBody(buffer, contentLength);
    }
    throw new Error('No HTTP parser implementation available');
  }

  /**
   * Reset the parser state
   */
  reset(): void {
    if (this.useNative && this.parser) {
      this.parser.reset();
    } else if (this.jsParser) {
      this.jsParser.reset();
    }
  }

  /**
   * Get performance metrics for HTTP parsing
   * @returns Performance metrics
   */
  static getPerformanceMetrics(): { jsTime: number; jsCount: number; nativeTime: number; nativeCount: number } {
    return {
      jsTime: HttpParser.jsParseTime,
      jsCount: HttpParser.jsParseCount,
      nativeTime: HttpParser.nativeParseTime,
      nativeCount: HttpParser.nativeParseCount
    };
  }

  /**
   * Reset performance metrics
   */
  static resetPerformanceMetrics(): void {
    HttpParser.jsParseTime = 0;
    HttpParser.jsParseCount = 0;
    HttpParser.nativeParseTime = 0;
    HttpParser.nativeParseCount = 0;
  }
}

/**
 * Radix Router Interface
 */
export interface RouteMatch {
  handler: any;
  params: Record<string, string>;
  found: boolean;
}

/**
 * Radix Router class that automatically chooses between native and JS implementations
 */
export class RadixRouter {
  private router: any;
  private useNative: boolean;
  private jsRouter: JsRadixRouter | null = null;

  // Performance metrics
  private static jsFindTime = 0;
  private static jsFindCount = 0;
  private static nativeFindTime = 0;
  private static nativeFindCount = 0;

  constructor(options?: { maxCacheSize?: number }) {
    const nativeModule = loadNativeBinding();
    this.useNative = !!(nativeModule?.RadixRouter && nativeOptions.enabled);

    if (this.useNative) {
      try {
        // Use maxCacheSize from nativeOptions if not provided in constructor options
        const maxCacheSize = options?.maxCacheSize ?? nativeOptions.maxCacheSize ?? 1000;
        this.router = new nativeModule.RadixRouter({ maxCacheSize });
      } catch (err: any) {
        if (nativeOptions.verbose) {
          console.warn(`Failed to create native radix router: ${err.message}`);
        }
        this.useNative = false;
      }
    }

    if (!this.useNative) {
      // Use JavaScript fallback
      this.jsRouter = new JsRadixRouter('');
    }
  }

  /**
   * Add a route to the router
   * @param method HTTP method
   * @param path Route path
   * @param handler Route handler
   * @returns This router instance for chaining
   */
  add(method: string, path: string, handler: any): this {
    if (this.useNative && this.router) {
      this.router.add(method, path, handler);
    } else if (this.jsRouter) {
      this.jsRouter.addRoute(method as HttpMethod, path, handler);
    } else {
      throw new Error('No router implementation available');
    }
    return this;
  }

  /**
   * Find a route handler
   * @param method HTTP method
   * @param path Request path
   * @returns Route match result
   */
  find(method: string, path: string): RouteMatch {
    const start = performance.now();
    let result: RouteMatch;

    if (this.useNative && this.router) {
      result = this.router.find(method, path);
      RadixRouter.nativeFindTime += performance.now() - start;
      RadixRouter.nativeFindCount++;
    } else if (this.jsRouter) {
      const jsResult = this.jsRouter.findRoute(method as HttpMethod, path);
      result = {
        handler: jsResult?.route?.handler || null,
        params: jsResult?.params || {},
        found: !!jsResult
      };
      RadixRouter.jsFindTime += performance.now() - start;
      RadixRouter.jsFindCount++;
    } else {
      throw new Error('No router implementation available');
    }

    return result;
  }

  /**
   * Remove a route
   * @param method HTTP method
   * @param path Route path
   * @returns Whether the route was removed
   */
  remove(method: string, path: string): boolean {
    if (this.useNative && this.router) {
      return this.router.remove(method, path);
    } else if (this.jsRouter) {
      // JavaScript implementation doesn't have a remove method
      // This is a stub implementation
      return false;
    } else {
      throw new Error('No router implementation available');
    }
  }

  /**
   * Get performance metrics for route finding
   * @returns Performance metrics
   */
  static getPerformanceMetrics(): { jsTime: number; jsCount: number; nativeTime: number; nativeCount: number } {
    return {
      jsTime: RadixRouter.jsFindTime,
      jsCount: RadixRouter.jsFindCount,
      nativeTime: RadixRouter.nativeFindTime,
      nativeCount: RadixRouter.nativeFindCount
    };
  }

  /**
   * Reset performance metrics
   */
  static resetPerformanceMetrics(): void {
    RadixRouter.jsFindTime = 0;
    RadixRouter.jsFindCount = 0;
    RadixRouter.nativeFindTime = 0;
    RadixRouter.nativeFindCount = 0;
  }
}

/**
 * JSON Processor Interface
 */
export class JsonProcessor {
  private processor: any;
  private useNative: boolean;

  // Performance metrics
  private static jsParseTime = 0;
  private static jsParseCount = 0;
  private static jsStringifyTime = 0;
  private static jsStringifyCount = 0;
  private static nativeParseTime = 0;
  private static nativeParseCount = 0;
  private static nativeStringifyTime = 0;
  private static nativeStringifyCount = 0;

  constructor() {
    const nativeModule = loadNativeBinding();
    this.useNative = !!(nativeModule?.JsonProcessor && nativeOptions.enabled);

    if (this.useNative) {
      try {
        this.processor = new nativeModule.JsonProcessor();
      } catch (err: any) {
        if (nativeOptions.verbose) {
          console.warn(`Failed to create native JSON processor: ${err.message}`);
        }
        this.useNative = false;
      }
    }
  }

  /**
   * Parse JSON
   * @param json JSON string or buffer
   * @returns Parsed JavaScript value
   */
  parse(json: string | Buffer): any {
    const start = performance.now();
    let result: any;

    if (this.useNative && this.processor) {
      result = this.processor.parse(json);
      JsonProcessor.nativeParseTime += performance.now() - start;
      JsonProcessor.nativeParseCount++;
    } else {
      // JavaScript fallback implementation
      result = JSON.parse(typeof json === 'string' ? json : json.toString());
      JsonProcessor.jsParseTime += performance.now() - start;
      JsonProcessor.jsParseCount++;
    }

    return result;
  }

  /**
   * Stringify a JavaScript value
   * @param value Value to stringify
   * @returns JSON string
   */
  stringify(value: any): string {
    const start = performance.now();
    let result: string;

    if (this.useNative && this.processor) {
      result = this.processor.stringify(value);
      JsonProcessor.nativeStringifyTime += performance.now() - start;
      JsonProcessor.nativeStringifyCount++;
    } else {
      // JavaScript fallback implementation
      result = JSON.stringify(value);
      JsonProcessor.jsStringifyTime += performance.now() - start;
      JsonProcessor.jsStringifyCount++;
    }

    return result;
  }

  /**
   * Parse a JSON stream
   * @param buffer Buffer containing JSON data
   * @returns Array of parsed objects
   */
  parseStream(buffer: Buffer): any[] {
    if (this.useNative && this.processor) {
      return this.processor.parseStream(buffer);
    } else {
      // Simple JavaScript fallback implementation
      const jsonStr = buffer.toString();
      const jsonLines = jsonStr.split('\n').filter(line => line.trim());
      return jsonLines.map(line => JSON.parse(line));
    }
  }

  /**
   * Stringify multiple values for streaming
   * @param values Array of values to stringify
   * @returns JSON string with newlines between values
   */
  stringifyStream(values: any[]): string {
    if (this.useNative && this.processor) {
      return this.processor.stringifyStream(values);
    } else {
      // JavaScript fallback implementation
      return values.map(v => JSON.stringify(v)).join('\n');
    }
  }

  /**
   * Get performance metrics for JSON processing
   * @returns Performance metrics
   */
  static getPerformanceMetrics(): {
    jsParseTime: number;
    jsParseCount: number;
    jsStringifyTime: number;
    jsStringifyCount: number;
    nativeParseTime: number;
    nativeParseCount: number;
    nativeStringifyTime: number;
    nativeStringifyCount: number;
  } {
    return {
      jsParseTime: JsonProcessor.jsParseTime,
      jsParseCount: JsonProcessor.jsParseCount,
      jsStringifyTime: JsonProcessor.jsStringifyTime,
      jsStringifyCount: JsonProcessor.jsStringifyCount,
      nativeParseTime: JsonProcessor.nativeParseTime,
      nativeParseCount: JsonProcessor.nativeParseCount,
      nativeStringifyTime: JsonProcessor.nativeStringifyTime,
      nativeStringifyCount: JsonProcessor.nativeStringifyCount
    };
  }

  /**
   * Reset performance metrics
   */
  static resetPerformanceMetrics(): void {
    JsonProcessor.jsParseTime = 0;
    JsonProcessor.jsParseCount = 0;
    JsonProcessor.jsStringifyTime = 0;
    JsonProcessor.jsStringifyCount = 0;
    JsonProcessor.nativeParseTime = 0;
    JsonProcessor.nativeParseCount = 0;
    JsonProcessor.nativeStringifyTime = 0;
    JsonProcessor.nativeStringifyCount = 0;
  }
}

/**
 * URL Parser implementation
 */
export class UrlParser {
  private parser: any;
  private useNative: boolean;

  constructor() {
    if (nativeBinding && nativeBinding.parse) {
      this.parser = nativeBinding;
      this.useNative = true;
    } else {
      this.useNative = false;
    }
  }

  parse(url: string): {
    protocol: string;
    auth: string;
    hostname: string;
    port: string;
    pathname: string;
    search: string;
    hash: string;
  } {
    if (this.useNative) {
      const start = performance.now();
      const result = this.parser.parse(url);
      const end = performance.now();
      UrlParser.nativeParseTime += (end - start);
      UrlParser.nativeParseCount++;
      return result;
    } else {
      // Fallback to URL API
      const start = performance.now();
      try {
        const parsedUrl = new URL(url);
        const result = {
          protocol: parsedUrl.protocol.replace(/:$/, ''),
          auth: parsedUrl.username && parsedUrl.password ?
            `${parsedUrl.username}:${parsedUrl.password}` :
            parsedUrl.username || '',
          hostname: parsedUrl.hostname,
          port: parsedUrl.port,
          pathname: parsedUrl.pathname,
          search: parsedUrl.search.replace(/^\?/, ''),
          hash: parsedUrl.hash.replace(/^#/, '')
        };
        const end = performance.now();
        UrlParser.jsParseTime += (end - start);
        UrlParser.jsParseCount++;
        return result;
      } catch (err) {
        const end = performance.now();
        UrlParser.jsParseTime += (end - start);
        UrlParser.jsParseCount++;
        return {
          protocol: '',
          auth: '',
          hostname: '',
          port: '',
          pathname: '',
          search: '',
          hash: ''
        };
      }
    }
  }

  parseQueryString(queryString: string): Record<string, string> {
    if (this.useNative) {
      const start = performance.now();
      const result = this.parser.parseQueryString(queryString);
      const end = performance.now();
      UrlParser.nativeParseTime += (end - start);
      UrlParser.nativeParseCount++;
      return result;
    } else {
      // Fallback to URLSearchParams
      const start = performance.now();
      const params: Record<string, string> = {};
      const searchParams = new URLSearchParams(queryString);
      searchParams.forEach((value, key) => {
        params[key] = value;
      });
      const end = performance.now();
      UrlParser.jsParseTime += (end - start);
      UrlParser.jsParseCount++;
      return params;
    }
  }

  // Performance metrics
  private static jsParseTime = 0;
  private static jsParseCount = 0;
  private static nativeParseTime = 0;
  private static nativeParseCount = 0;

  static getPerformanceMetrics(): { jsTime: number; jsCount: number; nativeTime: number; nativeCount: number } {
    return {
      jsTime: UrlParser.jsParseTime,
      jsCount: UrlParser.jsParseCount,
      nativeTime: UrlParser.nativeParseTime,
      nativeCount: UrlParser.nativeParseCount
    };
  }

  static resetPerformanceMetrics(): void {
    UrlParser.jsParseTime = 0;
    UrlParser.jsParseCount = 0;
    UrlParser.nativeParseTime = 0;
    UrlParser.nativeParseCount = 0;
  }
}

// Schema Validator implementation
export class SchemaValidator {
  private validator: any;
  private useNative: boolean;

  constructor() {
    if (nativeBinding && nativeBinding.validate) {
      this.validator = nativeBinding;
      this.useNative = true;
    } else {
      this.useNative = false;
    }
  }

  validate(schema: object, data: any): { valid: boolean; errors: { path: string; message: string }[] } {
    if (this.useNative) {
      const start = performance.now();
      const result = this.validator.validate(schema, data);
      const end = performance.now();
      SchemaValidator.nativeValidateTime += (end - start);
      SchemaValidator.nativeValidateCount++;
      return result;
    } else {
      // Simple JS fallback implementation
      const start = performance.now();
      const errors: { path: string; message: string }[] = [];
      this.validateValue(schema, data, '$', errors);
      const end = performance.now();
      SchemaValidator.jsValidateTime += (end - start);
      SchemaValidator.jsValidateCount++;
      return { valid: errors.length === 0, errors };
    }
  }

  // Simple validation implementation for fallback
  private validateValue(schema: any, value: any, path: string, errors: { path: string; message: string }[]): boolean {
    // Type validation
    if (schema.type) {
      const type = typeof value;
      if (schema.type === 'array' && !Array.isArray(value)) {
        errors.push({ path, message: 'Expected array' });
        return false;
      } else if (schema.type === 'object' && (typeof value !== 'object' || Array.isArray(value) || value === null)) {
        errors.push({ path, message: 'Expected object' });
        return false;
      } else if (schema.type === 'string' && type !== 'string') {
        errors.push({ path, message: 'Expected string' });
        return false;
      } else if (schema.type === 'number' && type !== 'number') {
        errors.push({ path, message: 'Expected number' });
        return false;
      } else if (schema.type === 'boolean' && type !== 'boolean') {
        errors.push({ path, message: 'Expected boolean' });
        return false;
      } else if (schema.type === 'null' && value !== null) {
        errors.push({ path, message: 'Expected null' });
        return false;
      }
    }

    // String validations
    if (schema.type === 'string' && typeof value === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push({ path, message: 'String too short' });
        return false;
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push({ path, message: 'String too long' });
        return false;
      }
    }

    // Number validations
    if (schema.type === 'number' && typeof value === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push({ path, message: 'Number too small' });
        return false;
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push({ path, message: 'Number too large' });
        return false;
      }
    }

    // Object validations
    if (schema.type === 'object' && typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if (schema.required && Array.isArray(schema.required)) {
        for (const prop of schema.required) {
          if (!(prop in value)) {
            errors.push({ path: `${path}.${prop}`, message: 'Required property missing' });
          }
        }
      }

      if (schema.properties) {
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          if (propName in value) {
            this.validateValue(propSchema, value[propName], `${path}.${propName}`, errors);
          }
        }
      }
    }

    // Array validations
    if (schema.type === 'array' && Array.isArray(value)) {
      if (schema.items) {
        for (let i = 0; i < value.length; i++) {
          this.validateValue(schema.items, value[i], `${path}[${i}]`, errors);
        }
      }
    }

    return errors.length === 0;
  }

  // Performance metrics
  private static jsValidateTime = 0;
  private static jsValidateCount = 0;
  private static nativeValidateTime = 0;
  private static nativeValidateCount = 0;

  static getPerformanceMetrics(): { jsTime: number; jsCount: number; nativeTime: number; nativeCount: number } {
    return {
      jsTime: SchemaValidator.jsValidateTime,
      jsCount: SchemaValidator.jsValidateCount,
      nativeTime: SchemaValidator.nativeValidateTime,
      nativeCount: SchemaValidator.nativeValidateCount
    };
  }

  static resetPerformanceMetrics(): void {
    SchemaValidator.jsValidateTime = 0;
    SchemaValidator.jsValidateCount = 0;
    SchemaValidator.nativeValidateTime = 0;
    SchemaValidator.nativeValidateCount = 0;
  }
}

// Compression implementation
export class Compression {
  private compressor: any;
  private useNative: boolean;

  constructor() {
    if (nativeBinding && nativeBinding.compress) {
      this.compressor = nativeBinding;
      this.useNative = true;
    } else {
      this.useNative = false;
    }
  }

  compress(data: Buffer | string, level = 6): Buffer {
    if (this.useNative) {
      const start = performance.now();
      const result = this.compressor.compress(data, level);
      const end = performance.now();
      Compression.nativeCompressTime += (end - start);
      Compression.nativeCompressCount++;
      return result;
    } else {
      // Fallback to zlib (slower)
      const start = performance.now();
      try {
        const zlib = require('node:zlib');
        const buffer = typeof data === 'string' ? Buffer.from(data) : data;
        const result = zlib.gzipSync(buffer, { level });
        const end = performance.now();
        Compression.jsCompressTime += (end - start);
        Compression.jsCompressCount++;
        return result;
      } catch (err) {
        const end = performance.now();
        Compression.jsCompressTime += (end - start);
        Compression.jsCompressCount++;
        throw err;
      }
    }
  }

  decompress(data: Buffer, asString = false): Buffer | string {
    if (this.useNative) {
      const start = performance.now();
      const result = this.compressor.decompress(data, asString);
      const end = performance.now();
      Compression.nativeDecompressTime += (end - start);
      Compression.nativeDecompressCount++;
      return result;
    } else {
      // Fallback to zlib (slower)
      const start = performance.now();
      try {
        const zlib = require('node:zlib');
        const result = zlib.gunzipSync(data);
        const end = performance.now();
        Compression.jsDecompressTime += (end - start);
        Compression.jsDecompressCount++;
        return asString ? result.toString() : result;
      } catch (err) {
        const end = performance.now();
        Compression.jsDecompressTime += (end - start);
        Compression.jsDecompressCount++;
        throw err;
      }
    }
  }

  // Performance metrics
  private static jsCompressTime = 0;
  private static jsCompressCount = 0;
  private static nativeCompressTime = 0;
  private static nativeCompressCount = 0;
  private static jsDecompressTime = 0;
  private static jsDecompressCount = 0;
  private static nativeDecompressTime = 0;
  private static nativeDecompressCount = 0;

  static getPerformanceMetrics(): {
    jsCompressTime: number;
    jsCompressCount: number;
    nativeCompressTime: number;
    nativeCompressCount: number;
    jsDecompressTime: number;
    jsDecompressCount: number;
    nativeDecompressTime: number;
    nativeDecompressCount: number;
  } {
    return {
      jsCompressTime: Compression.jsCompressTime,
      jsCompressCount: Compression.jsCompressCount,
      nativeCompressTime: Compression.nativeCompressTime,
      nativeCompressCount: Compression.nativeCompressCount,
      jsDecompressTime: Compression.jsDecompressTime,
      jsDecompressCount: Compression.jsDecompressCount,
      nativeDecompressTime: Compression.nativeDecompressTime,
      nativeDecompressCount: Compression.nativeDecompressCount
    };
  }

  static resetPerformanceMetrics(): void {
    Compression.jsCompressTime = 0;
    Compression.jsCompressCount = 0;
    Compression.nativeCompressTime = 0;
    Compression.nativeCompressCount = 0;
    Compression.jsDecompressTime = 0;
    Compression.jsDecompressCount = 0;
    Compression.nativeDecompressTime = 0;
    Compression.nativeDecompressCount = 0;
  }
}

/**
 * WebSocket Server
 * High-performance WebSocket server implementation using native C++ modules
 */
export class WebSocketServer extends EventEmitter {
  private nativeServer: any;
  private logger: Logger;
  private isRunning: boolean = false;
  private connections: Map<number, WebSocketConnection> = new Map();
  private authOptions: WebSocketAuthOptions;
  private heartbeatOptions: WebSocketHeartbeatOptions;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private serverOptions: WebSocketServerOptions;

  // Add static reference to the native module
  private static nativeModule = loadNativeBinding()?.NativeWebSocketServer;

  // Add static performance metrics
  private static nativeTime = 0;
  private static nativeCount = 0;

  /**
   * Create a new WebSocket server
   * @param httpServer The HTTP server to attach to
   * @param options WebSocket server options
   */
  constructor(
    private httpServer: HttpServer,
    options: WebSocketServerOptions = {}
  ) {
    super();
    this.logger = new Logger();

    // Default options
    this.serverOptions = options;

    // Set up authentication options
    this.authOptions = {
      required: false,
      timeout: 10000,
      handler: async () => null,
      ...options.auth
    };

    // Set up heartbeat options
    this.heartbeatOptions = {
      enabled: true,
      interval: 30000,
      timeout: 10000,
      ...options.heartbeat
    };

    // Try to load native module
    const nativeModule = loadNativeBinding();

    if (!nativeModule?.NativeWebSocketServer) {
      throw new Error('Native WebSocket module not available');
    }

    // Create native server instance
    this.nativeServer = new nativeModule.NativeWebSocketServer({
      onConnection: this.handleConnection.bind(this),
      onMessage: this.handleMessage.bind(this),
      onBinaryMessage: this.handleBinaryMessage.bind(this),
      onDisconnect: this.handleDisconnect.bind(this),
      onError: this.handleError.bind(this),
      onRoomJoin: this.handleRoomJoin.bind(this),
      onRoomLeave: this.handleRoomLeave.bind(this),
      onPong: this.handlePong.bind(this)
    });
  }

  /**
   * Start the WebSocket server
   * @param port The port to listen on (optional, uses HTTP server port if not provided)
   */
  start(port?: number): void {
    if (this.isRunning) return;

    try {
      this.nativeServer.start({
        server: this.httpServer,
        port
      });

      this.isRunning = true;
      this.logger.info('Native WebSocket server started');

      // Start heartbeat mechanism if enabled
      if (this.heartbeatOptions.enabled) {
        this.startHeartbeat();
      }
    } catch (error) {
      this.logger.error('Failed to start native WebSocket server:', error);
      throw error;
    }
  }

  /**
   * Stop the WebSocket server
   */
  stop(): void {
    if (!this.isRunning) return;

    try {
      // Stop heartbeat timer
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }

      this.nativeServer.stop();
      this.isRunning = false;
      this.logger.info('Native WebSocket server stopped');
    } catch (error) {
      this.logger.error('Failed to stop native WebSocket server:', error);
      throw error;
    }
  }

  /**
   * Broadcast a message to all connected clients
   * @param message The message to broadcast
   * @param exclude Connection to exclude from broadcast
   */
  broadcast(message: string | object, exclude?: WebSocketConnection): void {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    this.nativeServer.broadcast(messageStr, exclude ? (exclude as any).id : undefined);
  }

  /**
   * Broadcast a binary message to all connected clients
   * @param data The binary data to broadcast
   * @param exclude Connection to exclude from broadcast
   */
  broadcastBinary(data: Buffer, exclude?: WebSocketConnection): void {
    this.nativeServer.broadcastBinary(data, exclude ? (exclude as any).id : undefined);
  }

  /**
   * Broadcast a message to all clients in a room
   * @param roomName The room to broadcast to
   * @param message The message to broadcast
   * @param exclude Connection to exclude from broadcast
   */
  broadcastToRoom(roomName: string, message: string | object, exclude?: WebSocketConnection): void {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    this.nativeServer.broadcastToRoom(roomName, messageStr, exclude ? (exclude as any).id : undefined);
  }

  /**
   * Broadcast a binary message to all clients in a room
   * @param roomName The room to broadcast to
   * @param data The binary data to broadcast
   * @param exclude Connection to exclude from broadcast
   */
  broadcastBinaryToRoom(roomName: string, data: Buffer, exclude?: WebSocketConnection): void {
    this.nativeServer.broadcastBinaryToRoom(roomName, data, exclude ? (exclude as any).id : undefined);
  }

  /**
   * Get all room names
   * @returns Array of room names
   */
  getRooms(): string[] {
    return this.nativeServer.getRooms();
  }

  /**
   * Get the number of clients in a room
   * @param roomName The room name
   * @returns The number of clients in the room
   */
  getRoomSize(roomName: string): number {
    return this.nativeServer.getRoomSize(roomName);
  }

  /**
   * Get all connections in a room
   * @param roomName The room name
   * @returns Array of connections in the room
   */
  getRoomConnections(roomName: string): WebSocketConnection[] {
    const connectionIds = this.nativeServer.getRoomConnections(roomName);
    return connectionIds.map(id => this.connections.get(id)).filter(Boolean) as WebSocketConnection[];
  }

  /**
   * Get the total number of connections
   * @returns The total number of connections
   */
  getConnectionCount(): number {
    return this.nativeServer.getConnectionCount();
  }

  /**
   * Start the heartbeat mechanism
   * @private
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      this.checkConnections();
    }, this.heartbeatOptions.interval);

    this.logger.debug(`Heartbeat started with interval of ${this.heartbeatOptions.interval}ms`);
  }

  /**
   * Check all connections for activity
   * @private
   */
  private checkConnections(): void {
    const now = Date.now();
    const timeout = this.heartbeatOptions.timeout;

    for (const [id, connection] of this.connections.entries()) {
      // Skip check if connection was recently active
      if (now - connection.lastHeartbeat < this.heartbeatOptions.interval) {
        continue;
      }

      // Check if connection timed out
      if (now - connection.lastHeartbeat > timeout) {
        this.logger.debug(`Connection ${id} timed out, closing`);
        connection.close(1001, 'Connection timeout');
        continue;
      }

      // Send ping to check if connection is alive
      try {
        connection.ping();
      } catch (err) {
        this.logger.debug(`Failed to ping connection ${id}: ${err}`);
      }
    }
  }

  /**
   * Authenticate a WebSocket connection
   * @param connection The connection to authenticate
   * @param token The authentication token
   */
  async authenticateConnection(connection: WebSocketConnection, token: string): Promise<boolean> {
    try {
      // Call the authentication handler
      const user = await this.authOptions.handler(token, connection);

      if (user) {
        connection.isAuthenticated = true;
        connection.user = user;

        // Emit authenticated event
        this.emit('authenticated', { connection, user });

        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('Authentication error:', error);
      return false;
    }
  }

  /**
   * Handle a pong response from a client
   * @param data The data from the native module
   */
  private handlePong(data: any): void {
    const { id } = data;
    const connection = this.connections.get(id);

    if (connection) {
      connection.lastHeartbeat = Date.now();
      connection.isAlive = true;
    }
  }

  /**
   * Handle a new connection
   * @param data The data from the native module
   */
  private handleConnection(data: any): void {
    const { id } = data;
    const now = Date.now();

    // Create connection wrapper
    const connection: WebSocketConnection = {
      id,
      send: (message: string | object) => {
        const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
        this.nativeServer.send(id, messageStr);
      },
      sendBinary: (data: Buffer) => {
        this.nativeServer.sendBinary(id, data);
      },
      close: (code?: number, reason?: string) => {
        this.nativeServer.closeConnection(id, code, reason);
      },
      joinRoom: (roomName: string) => {
        this.nativeServer.joinRoom(id, roomName);
      },
      leaveRoom: (roomName: string) => {
        this.nativeServer.leaveRoom(id, roomName);
      },
      leaveAllRooms: () => {
        this.nativeServer.leaveAllRooms(id);
      },
      isInRoom: (roomName: string) => {
        return this.nativeServer.isInRoom(id, roomName);
      },
      getRooms: () => {
        return this.nativeServer.getConnectionRooms(id);
      },
      isAlive: true,
      isAuthenticated: false,
      data: {},
      lastHeartbeat: now,
      ping: () => {
        this.nativeServer.ping(id);
      }
    };

    // Store connection
    this.connections.set(id, connection);

    // Emit connection event
    this.emit('connection', { connection });

    // Set up authentication timeout if required
    if (this.authOptions.required) {
      const timeout = setTimeout(() => {
        // Check if the connection is still active but not authenticated
        const conn = this.connections.get(id);
        if (conn && !conn.isAuthenticated) {
          this.logger.debug(`Connection ${id} failed to authenticate within timeout, closing`);
          conn.close(1008, 'Authentication timeout');
        }
      }, this.authOptions.timeout);

      // Store timeout reference for cleanup
      connection.data.__authTimeout = timeout;
    }
  }

  /**
   * Handle a message from a client
   * @param data The data from the native module
   */
  private handleMessage(data: any): void {
    const { id, message } = data;
    const connection = this.connections.get(id);

    if (!connection) return;

    // Update heartbeat timestamp
    connection.lastHeartbeat = Date.now();

    try {
      const parsedMessage = typeof message === 'string' ? JSON.parse(message) : message;

      // Handle auth message type if not authenticated
      if (!connection.isAuthenticated && this.authOptions.required && parsedMessage.type === 'auth') {
        this.authenticateConnection(connection, parsedMessage.data.token)
          .then(success => {
            // Clear authentication timeout
            if (connection.data.__authTimeout) {
              clearTimeout(connection.data.__authTimeout);
              delete connection.data.__authTimeout;
            }

            // Send auth response
            connection.send({
              type: 'auth:response',
              data: { success }
            });

            // Close connection if authentication failed
            if (!success) {
              connection.close(1008, 'Authentication failed');
            }
          });

        return;
      }

      // Require authentication if enabled
      if (this.authOptions.required && !connection.isAuthenticated) {
        connection.send({
          type: 'error',
          data: { message: 'Authentication required' }
        });
        return;
      }

      // Emit message event
      this.emit('message', {
        connection,
        message: parsedMessage
      });

      // Emit specific event type if available
      if (parsedMessage.type) {
        this.emit(parsedMessage.type, {
          connection,
          message: parsedMessage
        });
      }
    } catch (error) {
      this.logger.error('Error handling WebSocket message:', error);

      // Notify client of error
      connection.send({
        type: 'error',
        data: { message: 'Invalid message format' }
      });
    }
  }

  /**
   * Handle a binary message from a client
   * @param data The data from the native module
   */
  private handleBinaryMessage(data: any): void {
    const { id, binary } = data;
    const connection = this.connections.get(id);

    if (!connection) return;

    // Emit binary message event
    this.emit('binary', {
      connection,
      binary: Buffer.from(binary)
    });
  }

  /**
   * Handle a client disconnection
   * @param data The data from the native module
   */
  private handleDisconnect(data: any): void {
    const { id } = data;
    const connection = this.connections.get(id);

    if (!connection) return;

    // Emit disconnect event
    this.emit('disconnect', { connection });

    // Remove connection
    this.connections.delete(id);
  }

  /**
   * Handle an error
   * @param data The data from the native module
   */
  private handleError(data: any): void {
    const { id, error } = data;
    const connection = this.connections.get(id);

    // Emit error event
    this.emit('error', {
      connection,
      error: new Error(error)
    });
  }

  /**
   * Handle a room join
   * @param data The data from the native module
   */
  private handleRoomJoin(data: any): void {
    const { id, room } = data;
    const connection = this.connections.get(id);

    if (!connection) return;

    // Emit room join event
    this.emit('room:join', {
      connection,
      room
    });
  }

  /**
   * Handle a room leave
   * @param data The data from the native module
   */
  private handleRoomLeave(data: any): void {
    const { id, room } = data;
    const connection = this.connections.get(id);

    if (!connection) return;

    // Emit room leave event
    this.emit('room:leave', {
      connection,
      room
    });
  }

  /**
   * Set the authentication handler function for this server
   * @param handler The function to call when authenticating a connection
   */
  setAuthenticationHandler(handler: (token: string, connection: WebSocketConnection) => Promise<any>): void {
    this.authOptions.handler = handler;
  }

  /**
   * Set heartbeat options for this server
   * @param options Heartbeat configuration options
   */
  setHeartbeatOptions(options: Partial<WebSocketHeartbeatOptions>): void {
    this.heartbeatOptions = { ...this.heartbeatOptions, ...options };

    // Restart heartbeat if needed
    if (this.isRunning && this.heartbeatOptions.enabled) {
      this.startHeartbeat();
    }
  }

  /**
   * Set the maximum number of clients per room
   * @param max Maximum number of clients per room (0 = unlimited)
   */
  setMaxClientsPerRoom(max: number): void {
    this.serverOptions.maxClientsPerRoom = max;
  }

  /**
   * Get connection by ID
   * @param id The connection ID
   */
  getConnection(id: number): WebSocketConnection | undefined {
    return this.connections.get(id);
  }

  /**
   * Get all connections
   */
  getAllConnections(): WebSocketConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get message history for a room
   * @param roomName The room name
   * @returns Array of message strings
   */
  getRoomHistory(roomName: string): string[] {
    return this.nativeServer.getRoomHistory(roomName);
  }

  /**
   * Set maximum size for a room
   * @param roomName The room name
   * @param maxSize Maximum number of clients (0 = unlimited)
   */
  setMaxRoomSize(roomName: string, maxSize: number): void {
    this.nativeServer.setMaxRoomSize(roomName, maxSize);
  }

  /**
   * Set maximum number of connections
   * @param maxConnections Maximum number of connections (0 = unlimited)
   */
  setMaxConnections(maxConnections: number): void {
    this.nativeServer.setMaxConnections(maxConnections);
    this.serverOptions.maxConnections = maxConnections;
  }

  /**
   * Set whether a connection is authenticated
   * @param id The connection ID
   * @param authenticated Whether the connection is authenticated
   */
  setConnectionAuthenticated(id: number, authenticated: boolean): void {
    this.nativeServer.setAuthenticated(id, authenticated);

    const connection = this.connections.get(id);
    if (connection) {
      connection.isAuthenticated = authenticated;
    }
  }

  /**
   * Get connection statistics
   * @returns WebSocket connection statistics
   */
  getConnectionStats(): WebSocketConnectionStats {
    return this.nativeServer.getConnectionStats();
  }

  /**
   * Disconnect inactive connections
   * @param thresholdMs Inactivity threshold in milliseconds
   */
  disconnectInactiveConnections(thresholdMs: number): void {
    this.nativeServer.disconnectInactiveConnections(thresholdMs);
  }

  /**
   * Store a message in a room's history
   * @param roomName The room name
   * @param message The message to store
   * @param maxHistory Maximum history size (0 = unlimited)
   */
  storeRoomMessage(roomName: string, message: string | object, maxHistory: number = 100): void {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);

    try {
      // Use direct storage via native module if possible
      if (this.nativeServer.storeRoomMessage) {
        this.nativeServer.storeRoomMessage(roomName, messageStr, maxHistory);
      }
    } catch (error) {
      this.logger.error('Error storing room message:', error);
    }
  }

  /**
   * Get all authenticated connections
   * @returns Array of authenticated connections
   */
  getAuthenticatedConnections(): WebSocketConnection[] {
    return Array.from(this.connections.values()).filter(conn => conn.isAuthenticated);
  }

  /**
   * Get authenticated connections in a room
   * @param roomName The room name
   * @returns Array of authenticated connections in the room
   */
  getAuthenticatedRoomConnections(roomName: string): WebSocketConnection[] {
    return this.getRoomConnections(roomName).filter(conn => conn.isAuthenticated);
  }

  /**
   * Get performance metrics for WebSocket server
   * @returns Performance metrics
   */
  static getPerformanceMetrics(): {
    nativeTime: number;
    nativeCount: number;
  } {
    // Check if the native module has getPerformanceMetrics method
    if (WebSocketServer.nativeModule && typeof WebSocketServer.nativeModule.getPerformanceMetrics === 'function') {
      return {
        nativeTime: WebSocketServer.nativeModule.getPerformanceMetrics().nativeTime,
        nativeCount: WebSocketServer.nativeModule.getPerformanceMetrics().nativeCount
      };
    }

    // Return static metrics if native method is not available
    return {
      nativeTime: WebSocketServer.nativeTime,
      nativeCount: WebSocketServer.nativeCount
    };
  }

  /**
   * Reset performance metrics for WebSocket server
   */
  static resetPerformanceMetrics(): void {
    // Check if the native module has resetPerformanceMetrics method
    if (WebSocketServer.nativeModule && typeof WebSocketServer.nativeModule.resetPerformanceMetrics === 'function') {
      WebSocketServer.nativeModule.resetPerformanceMetrics();
    } else {
      // Reset static metrics if native method is not available
      WebSocketServer.nativeTime = 0;
      WebSocketServer.nativeCount = 0;
    }
  }
}

/**
 * Reset all performance metrics
 */
export function resetAllPerformanceMetrics(): void {
  // Import the resetNativeBindingMetrics function
  const { resetNativeBindingMetrics } = require('../utils/native-bindings');

  HttpParser.resetPerformanceMetrics();
  RadixRouter.resetPerformanceMetrics();
  JsonProcessor.resetPerformanceMetrics();
  UrlParser.resetPerformanceMetrics();
  SchemaValidator.resetPerformanceMetrics();
  Compression.resetPerformanceMetrics();
  WebSocketServer.resetPerformanceMetrics();
  resetNativeBindingMetrics();
}

/**
 * Get all performance metrics
 */
export function getAllPerformanceMetrics(): {
  httpParser: ReturnType<typeof HttpParser.getPerformanceMetrics>;
  radixRouter: ReturnType<typeof RadixRouter.getPerformanceMetrics>;
  jsonProcessor: ReturnType<typeof JsonProcessor.getPerformanceMetrics>;
  urlParser: ReturnType<typeof UrlParser.getPerformanceMetrics>;
  schemaValidator: ReturnType<typeof SchemaValidator.getPerformanceMetrics>;
  compression: ReturnType<typeof Compression.getPerformanceMetrics>;
  websocket: ReturnType<typeof WebSocketServer.getPerformanceMetrics>;
  nativeBindings: ReturnType<typeof import('../utils/native-bindings').getNativeBindingMetrics>;
} {
  // Import the getNativeBindingMetrics function
  const { getNativeBindingMetrics } = require('../utils/native-bindings');

  return {
    httpParser: HttpParser.getPerformanceMetrics(),
    radixRouter: RadixRouter.getPerformanceMetrics(),
    jsonProcessor: JsonProcessor.getPerformanceMetrics(),
    urlParser: UrlParser.getPerformanceMetrics(),
    schemaValidator: SchemaValidator.getPerformanceMetrics(),
    compression: Compression.getPerformanceMetrics(),
    websocket: WebSocketServer.getPerformanceMetrics(),
    nativeBindings: getNativeBindingMetrics()
  };
}

// Export native module status
export const hasNativeSupport = !!loadNativeBinding();
