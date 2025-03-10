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
  jsonProcessor: false
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
      jsonProcessor: false
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
    this.useNative = !!(nativeModule && nativeModule.HttpParser && nativeOptions.enabled);

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
  static getPerformanceMetrics() {
    return {
      js: {
        avgTime: HttpParser.jsParseCount > 0 ? HttpParser.jsParseTime / HttpParser.jsParseCount : 0,
        count: HttpParser.jsParseCount,
        totalTime: HttpParser.jsParseTime
      },
      native: {
        avgTime: HttpParser.nativeParseCount > 0 ? HttpParser.nativeParseTime / HttpParser.nativeParseCount : 0,
        count: HttpParser.nativeParseCount,
        totalTime: HttpParser.nativeParseTime
      },
      comparison: HttpParser.nativeParseCount > 0 && HttpParser.jsParseCount > 0
        ? (HttpParser.jsParseTime / HttpParser.jsParseCount) / (HttpParser.nativeParseTime / HttpParser.nativeParseCount)
        : 0
    };
  }

  /**
   * Reset performance metrics
   */
  static resetPerformanceMetrics() {
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
    this.useNative = !!(nativeModule && nativeModule.RadixRouter && nativeOptions.enabled);

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
  static getPerformanceMetrics() {
    return {
      js: {
        avgTime: RadixRouter.jsFindCount > 0 ? RadixRouter.jsFindTime / RadixRouter.jsFindCount : 0,
        count: RadixRouter.jsFindCount,
        totalTime: RadixRouter.jsFindTime
      },
      native: {
        avgTime: RadixRouter.nativeFindCount > 0 ? RadixRouter.nativeFindTime / RadixRouter.nativeFindCount : 0,
        count: RadixRouter.nativeFindCount,
        totalTime: RadixRouter.nativeFindTime
      },
      comparison: RadixRouter.nativeFindCount > 0 && RadixRouter.jsFindCount > 0
        ? (RadixRouter.jsFindTime / RadixRouter.jsFindCount) / (RadixRouter.nativeFindTime / RadixRouter.nativeFindCount)
        : 0
    };
  }

  /**
   * Reset performance metrics
   */
  static resetPerformanceMetrics() {
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
    this.useNative = !!(nativeModule && nativeModule.JsonProcessor && nativeOptions.enabled);

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
  static getPerformanceMetrics() {
    return {
      parse: {
        js: {
          avgTime: JsonProcessor.jsParseCount > 0 ? JsonProcessor.jsParseTime / JsonProcessor.jsParseCount : 0,
          count: JsonProcessor.jsParseCount,
          totalTime: JsonProcessor.jsParseTime
        },
        native: {
          avgTime: JsonProcessor.nativeParseCount > 0 ? JsonProcessor.nativeParseTime / JsonProcessor.nativeParseCount : 0,
          count: JsonProcessor.nativeParseCount,
          totalTime: JsonProcessor.nativeParseTime
        },
        comparison: JsonProcessor.nativeParseCount > 0 && JsonProcessor.jsParseCount > 0
          ? (JsonProcessor.jsParseTime / JsonProcessor.jsParseCount) / (JsonProcessor.nativeParseTime / JsonProcessor.nativeParseCount)
          : 0
      },
      stringify: {
        js: {
          avgTime: JsonProcessor.jsStringifyCount > 0 ? JsonProcessor.jsStringifyTime / JsonProcessor.jsStringifyCount : 0,
          count: JsonProcessor.jsStringifyCount,
          totalTime: JsonProcessor.jsStringifyTime
        },
        native: {
          avgTime: JsonProcessor.nativeStringifyCount > 0 ? JsonProcessor.nativeStringifyTime / JsonProcessor.nativeStringifyCount : 0,
          count: JsonProcessor.nativeStringifyCount,
          totalTime: JsonProcessor.nativeStringifyTime
        },
        comparison: JsonProcessor.nativeStringifyCount > 0 && JsonProcessor.jsStringifyCount > 0
          ? (JsonProcessor.jsStringifyTime / JsonProcessor.jsStringifyCount) / (JsonProcessor.nativeStringifyTime / JsonProcessor.nativeStringifyCount)
          : 0
      }
    };
  }

  /**
   * Reset performance metrics
   */
  static resetPerformanceMetrics() {
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
 * Reset all performance metrics
 */
export function resetAllPerformanceMetrics() {
  HttpParser.resetPerformanceMetrics();
  RadixRouter.resetPerformanceMetrics();
  JsonProcessor.resetPerformanceMetrics();
}

/**
 * Get all performance metrics
 */
export function getAllPerformanceMetrics() {
  return {
    httpParser: HttpParser.getPerformanceMetrics(),
    radixRouter: RadixRouter.getPerformanceMetrics(),
    jsonProcessor: JsonProcessor.getPerformanceMetrics()
  };
}

// Export native module status
export const hasNativeSupport = !!loadNativeBinding();
