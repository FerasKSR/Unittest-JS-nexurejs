/**
 * NexureJS Native Module
 *
 * This module provides high-performance C++ implementations of core components.
 */

import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HttpParser as JsHttpParser, HttpParseResult } from '../http/http-parser.js';
import { RadixRouter as JsRadixRouter } from '../routing/radix-router.js';
import { HttpMethod } from '../http/http-method.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to load the native module
let nativeBinding: any;
try {
  // Determine the path to the native module
  const bindingPath = join(__dirname, '..', '..', '..', 'build', 'Release', 'nexurejs_native.node');

  if (existsSync(bindingPath)) {
    // Load the native module
    nativeBinding = require(bindingPath);
  } else {
    throw new Error(`Native module not found at ${bindingPath}`);
  }
} catch (err: any) {
  console.warn(`Failed to load native module: ${err.message}`);
  console.warn('Using JavaScript fallbacks instead');
  nativeBinding = null;
}

/**
 * HTTP Parser Interface
 */
export { HttpParseResult };

export class HttpParser {
  private parser: any;
  private useNative: boolean;
  private jsParser: JsHttpParser | null = null;

  constructor() {
    this.useNative = !!nativeBinding;

    if (this.useNative) {
      try {
        this.parser = new nativeBinding.HttpParser();
      } catch (err: any) {
        console.warn(`Failed to create native HTTP parser: ${err.message}`);
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
    if (this.useNative && this.parser) {
      return this.parser.parse(buffer);
    } else if (this.jsParser) {
      return this.jsParser.parse(buffer);
    } else {
      throw new Error('No HTTP parser implementation available');
    }
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

  constructor(options?: { maxCacheSize?: number }) {
    this.useNative = !!nativeBinding;

    if (this.useNative) {
      try {
        this.router = new nativeBinding.RadixRouter(options);
      } catch (err: any) {
        console.warn(`Failed to create native radix router: ${err.message}`);
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
    if (this.useNative && this.router) {
      return this.router.find(method, path);
    } else if (this.jsRouter) {
      const result = this.jsRouter.findRoute(method as HttpMethod, path);
      return {
        handler: result?.route?.handler || null,
        params: result?.params || {},
        found: !!result
      };
    } else {
      throw new Error('No router implementation available');
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
    } else if (this.jsRouter) {
      // JavaScript implementation doesn't have a remove method
      // This is a stub implementation
      return false;
    } else {
      throw new Error('No router implementation available');
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
      } catch (err: any) {
        console.warn(`Failed to create native JSON processor: ${err.message}`);
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
}

// Export native module status
export const hasNativeSupport = !!nativeBinding;
