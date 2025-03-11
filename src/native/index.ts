/**
 * NexureJS Native Module
 *
 * This module provides high-performance C++ implementations of core components.
 */

import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { JsHttpParser } from '../http/http-parser.js';
import { RadixRouter as JsRadixRouter } from '../routing/radix-router.js';
import { HttpMethod } from '../http/http-method.js';
import type { HttpParseResult, NativeHttpParser } from '../types/native.js';

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
  /** Error message if loading failed */
  error?: string;
}

// Default configuration
let nativeOptions: NativeModuleOptions = {
  enabled: true,
  verbose: false,
  maxCacheSize: 1000
};

// Native module loading state
let nativeBinding: any = null;
let nativeBindingAttempted = false;
let nativeModuleStatus: NativeModuleStatus = {
  loaded: false,
  httpParser: false,
  radixRouter: false,
  jsonProcessor: false,
  urlParser: false,
  schemaValidator: false,
  compression: false
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
    nativeModuleStatus = {
      loaded: false,
      httpParser: false,
      radixRouter: false,
      jsonProcessor: false,
      urlParser: false,
      schemaValidator: false,
      compression: false
    };
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
  return { ...nativeModuleStatus };
}

/**
 * Load the native module
 * @returns The native module or null if not available
 */
function loadNativeBinding(): any {
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
 * Reset all performance metrics
 */
export function resetAllPerformanceMetrics(): void {
  HttpParser.resetPerformanceMetrics();
  RadixRouter.resetPerformanceMetrics();
  JsonProcessor.resetPerformanceMetrics();
  UrlParser.resetPerformanceMetrics();
  SchemaValidator.resetPerformanceMetrics();
  Compression.resetPerformanceMetrics();
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
} {
  return {
    httpParser: HttpParser.getPerformanceMetrics(),
    radixRouter: RadixRouter.getPerformanceMetrics(),
    jsonProcessor: JsonProcessor.getPerformanceMetrics(),
    urlParser: UrlParser.getPerformanceMetrics(),
    schemaValidator: SchemaValidator.getPerformanceMetrics(),
    compression: Compression.getPerformanceMetrics()
  };
}

// Export native module status
export const hasNativeSupport = !!loadNativeBinding();
