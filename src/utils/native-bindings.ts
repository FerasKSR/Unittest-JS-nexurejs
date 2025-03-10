/**
 * Native bindings utility for performance-critical operations
 *
 * This module provides an abstraction layer for integrating native C/C++ modules
 * when available, with graceful fallback to JavaScript implementations.
 */

import { Logger } from './logger.js';

const logger = new Logger();

/**
 * Available native binding categories
 */
export enum BindingType {
  JSON_PARSER = 'json-parser',
  COMPRESSION = 'compression',
  CRYPTO = 'crypto',
  URL_PARSER = 'url-parser'
}

/**
 * Registry of available native bindings
 */
const availableBindings: Record<BindingType, any> = {
  [BindingType.JSON_PARSER]: null,
  [BindingType.COMPRESSION]: null,
  [BindingType.CRYPTO]: null,
  [BindingType.URL_PARSER]: null
};

// Native module types
const _JSON_PARSER = 'json-parser';
const _COMPRESSION = 'compression';
const _CRYPTO = 'crypto';
const _URL_PARSER = 'url-parser';

/**
 * Try to load a native binding module
 * @param type The binding type to load
 * @param moduleName The name of the module to try loading
 */
export function tryLoadNativeBinding(type: BindingType, moduleName: string): boolean {
  try {
    // Dynamic import is used to avoid crashing if the module is not available
    const binding = require(moduleName);
    availableBindings[type] = binding;
    logger.info(`Native binding loaded for ${type}: ${moduleName}`);
    return true;
  } catch (_error) {
    logger.debug(`Native binding not available for ${type}: ${moduleName}`);
    return false;
  }
}

/**
 * Check if a native binding is available
 * @param type The binding type to check
 */
export function hasNativeBinding(type: BindingType): boolean {
  return availableBindings[type] !== null;
}

/**
 * Get a native binding if available
 * @param type The binding type to get
 */
export function getNativeBinding<T = any>(type: BindingType): T | null {
  return availableBindings[type] as T | null;
}

/**
 * Fast JSON parsing with native binding fallback
 * @param data The JSON string to parse
 */
export function fastJsonParse(data: string): any {
  const jsonParser = getNativeBinding(BindingType.JSON_PARSER);

  if (jsonParser && typeof jsonParser.parse === 'function') {
    return jsonParser.parse(data);
  }

  return JSON.parse(data);
}

/**
 * Fast JSON stringification with native binding fallback
 * @param data The data to stringify
 */
export function fastJsonStringify(data: any): string {
  const jsonParser = getNativeBinding(BindingType.JSON_PARSER);

  if (jsonParser && typeof jsonParser.stringify === 'function') {
    return jsonParser.stringify(data);
  }

  return JSON.stringify(data);
}

/**
 * Initialize available native bindings
 */
export function initNativeBindings(): void {
  // Try to load common native binding modules
  tryLoadNativeBinding(BindingType.JSON_PARSER, 'simdjson');
  tryLoadNativeBinding(BindingType.COMPRESSION, 'zlib-sync');
  tryLoadNativeBinding(BindingType.CRYPTO, 'node-sodium');
  tryLoadNativeBinding(BindingType.URL_PARSER, 'fast-url-parser');

  logger.info('Native bindings initialization completed');
}
