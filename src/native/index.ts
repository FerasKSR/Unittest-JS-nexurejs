/**
 * NexureJS Native Module
 *
 * This module provides high-performance C++ implementations of core components.
 */

import { join } from 'path';
import { existsSync } from 'fs';

// Try to load the native module
let nativeBinding: any;
try {
  // Determine the path to the native module
  const bindingPath = join(__dirname, '..', '..', 'build', 'Release', 'nexurejs_native.node');

  if (existsSync(bindingPath)) {
    // Load the native module
    nativeBinding = require(bindingPath);
  } else {
    throw new Error(`Native module not found at ${bindingPath}`);
  }
} catch (err: unknown) {
  const errorMessage = err instanceof Error ? err.message : String(err);
  console.warn(`Failed to load native module: ${errorMessage}`);
  console.warn('Using JavaScript fallbacks instead');
  nativeBinding = null;
}

/**
 * HTTP Parser Interface
 */
export interface HttpParseResult {
  method: string;
  url: string;
  httpVersion: string;
  headers: Record<string, string>;
  body: Buffer | null;
  complete: boolean;
}

export class HttpParser {
  private parser: any;
  private useNative: boolean;

  constructor() {
    this.useNative = !!nativeBinding;

    if (this.useNative) {
      try {
        this.parser = new nativeBinding.HttpParser();
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.warn(`Failed to create native HTTP parser: ${errorMessage}`);
        this.useNative = false;
      }
    }

    if (!this.useNative) {
      // Use JavaScript fallback
      this.parser = null;
    }
  }

  /**
   * Parse an HTTP request
   * @param buffer The HTTP request buffer
   * @returns Parsed HTTP request
   */
  parse(buffer: Buffer): HttpParseResult {
    if (this.useNative && this.parser) {
      return this.parser.parse(buffer);
    } else {
      // JavaScript fallback implementation
      // This would be implemented in a separate file
      throw new Error('JavaScript fallback not implemented');
    }
  }

  /**
   * Reset the parser state
   */
  reset(): void {
    if (this.useNative && this.parser) {
      this.parser.reset();
    }
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

  constructor(options?: { maxCacheSize?: number }) {
    this.useNative = !!nativeBinding;

    if (this.useNative) {
      try {
        this.router = new nativeBinding.RadixRouter(options);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.warn(`Failed to create native radix router: ${errorMessage}`);
        this.useNative = false;
      }
    }

    if (!this.useNative) {
      // Use JavaScript fallback
      this.router = null;
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
    } else {
      // JavaScript fallback implementation
      throw new Error('JavaScript fallback not implemented');
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
    if (this.useNative && this.router) {
      return this.router.find(method, path);
    } else {
      // JavaScript fallback implementation
      throw new Error('JavaScript fallback not implemented');
    }
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
    } else {
      // JavaScript fallback implementation
      throw new Error('JavaScript fallback not implemented');
    }
  }
}

/**
 * JSON Processor Interface
 */
export class JsonProcessor {
  private processor: any;
  private useNative: boolean;

  constructor() {
    this.useNative = !!nativeBinding;

    if (this.useNative) {
      try {
        this.processor = new nativeBinding.JsonProcessor();
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.warn(`Failed to create native JSON processor: ${errorMessage}`);
        this.useNative = false;
      }
    }

    if (!this.useNative) {
      // Use JavaScript fallback
      this.processor = null;
    }
  }

  /**
   * Parse JSON
   * @param json JSON string or buffer
   * @returns Parsed JavaScript value
   */
  parse(json: string | Buffer): any {
    if (this.useNative && this.processor) {
      return this.processor.parse(json);
    } else {
      // JavaScript fallback implementation
      return JSON.parse(typeof json === 'string' ? json : json.toString());
    }
  }

  /**
   * Stringify a JavaScript value
   * @param value Value to stringify
   * @returns JSON string
   */
  stringify(value: any): string {
    if (this.useNative && this.processor) {
      return this.processor.stringify(value);
    } else {
      // JavaScript fallback implementation
      return JSON.stringify(value);
    }
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
      // JavaScript fallback implementation
      throw new Error('JavaScript fallback not implemented');
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
}

// Export native module status
export const hasNativeSupport = !!nativeBinding;
