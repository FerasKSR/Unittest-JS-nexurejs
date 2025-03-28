/**
 * Native bindings utility for performance-critical operations
 *
 * This module provides an abstraction layer for integrating native C/C++ modules
 * when available, with graceful fallback to JavaScript implementations.
 */

import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { Logger } from './logger';

const logger = new Logger();

/**
 * Available native binding categories
 */
export enum BindingType {
  JSON_PARSER = 'json-parser',
  COMPRESSION = 'compression',
  CRYPTO = 'crypto',
  URL_PARSER = 'url-parser',
  WEBSOCKET = 'websocket',
  HTTP_PARSER = 'http-parser',
  ROUTER = 'router',
  SCHEMA = 'schema'
}

// Controls whether to enable native modules by default
let useNativeByDefault = true;

/**
 * Registry of available native bindings
 */
const nativeBindings: Record<BindingType, any> = {
  [BindingType.JSON_PARSER]: null,
  [BindingType.COMPRESSION]: null,
  [BindingType.CRYPTO]: null,
  [BindingType.URL_PARSER]: null,
  [BindingType.WEBSOCKET]: null,
  [BindingType.HTTP_PARSER]: null,
  [BindingType.ROUTER]: null,
  [BindingType.SCHEMA]: null
};

// Module cache to prevent redundant loading attempts
const moduleCache: Record<string, any> = {};

// Performance metrics
let loadAttempts = 0;
let loadSuccesses = 0;
let totalLoadTime = 0;

/**
 * Set whether native modules should be used by default
 * @param useNative Whether to use native modules by default
 */
export function setUseNativeByDefault(useNative: boolean): void {
  useNativeByDefault = useNative;
  logger.info(`Native modules will ${useNative ? 'be used' : 'not be used'} by default`);
}

/**
 * Get whether native modules are used by default
 * @returns Whether native modules are used by default
 */
export function getUseNativeByDefault(): boolean {
  return useNativeByDefault;
}

/**
 * Try to load a native binding module
 * @param type The binding type
 * @param moduleName The module name to require
 * @returns True if the binding was loaded successfully
 */
export function tryLoadNativeBinding(type: BindingType, moduleName: string): boolean {
  // Check if already loaded
  if (nativeBindings[type] !== null) {
    return true;
  }

  // Check if module is already in cache
  if (moduleCache[moduleName] !== undefined) {
    nativeBindings[type] = moduleCache[moduleName];
    return moduleCache[moduleName] !== null;
  }

  // Skip loading if native modules are disabled
  if (!useNativeByDefault) {
    logger.debug(`Skipped loading native binding ${moduleName} (native modules disabled)`);
    return false;
  }

  loadAttempts++;
  const startTime = performance.now();

  try {
    // Try to load the module
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nativeBinding = require(moduleName);
    const endTime = performance.now();
    const loadTime = endTime - startTime;
    totalLoadTime += loadTime;

    // Store in cache
    moduleCache[moduleName] = nativeBinding;
    nativeBindings[type] = nativeBinding;

    loadSuccesses++;
    logger.debug(`Native binding loaded successfully in ${loadTime.toFixed(2)}ms: ${moduleName}`);
    return true;
  } catch (_error) {
    const endTime = performance.now();
    totalLoadTime += endTime - startTime;

    // Cache the failure
    moduleCache[moduleName] = null;
    logger.debug(`Failed to load native binding: ${moduleName}`);
    return false;
  }
}

/**
 * Check if a native binding is available
 * @param type The binding type to check
 * @returns True if the binding is available
 */
export function hasNativeBinding(type: BindingType): boolean {
  return nativeBindings[type] !== null;
}

/**
 * Get a native binding
 * @param type The binding type to get
 * @returns The native binding or null if not available
 */
export function getNativeBinding(type: BindingType): any {
  return nativeBindings[type];
}

/**
 * Fast JSON parse with native acceleration when available
 * @param json The JSON string to parse
 * @returns The parsed object
 */
export function fastJsonParse(json: string): any {
  if (useNativeByDefault && hasNativeBinding(BindingType.JSON_PARSER)) {
    try {
      return nativeBindings[BindingType.JSON_PARSER].parse(json);
    } catch (_error) {
      // Fallback to native JSON.parse
      return JSON.parse(json);
    }
  }

  return JSON.parse(json);
}

/**
 * Fast JSON stringify with native acceleration when available
 * @param obj The object to stringify
 * @returns The JSON string
 */
export function fastJsonStringify(obj: any): string {
  if (useNativeByDefault && hasNativeBinding(BindingType.JSON_PARSER)) {
    try {
      return nativeBindings[BindingType.JSON_PARSER].stringify(obj);
    } catch (_error) {
      // Fallback to native JSON.stringify
      return JSON.stringify(obj);
    }
  }

  return JSON.stringify(obj);
}

/**
 * Initialize available native bindings
 * @param forceUseNative Force native modules to be used even if useNativeByDefault is false
 */
export function initNativeBindings(forceUseNative?: boolean): void {
  const shouldUseNative = forceUseNative || useNativeByDefault;

  if (!shouldUseNative) {
    logger.info('Native bindings initialization skipped (native modules disabled)');
    return;
  }

  logger.info('Initializing native bindings...');

  // Try loading prebuilt packages first
  const loadedPrebuild = tryLoadPrebuiltPackages();

  // If no prebuild was loaded, try individual packages
  if (!loadedPrebuild) {
    loadIndividualModules();
  }

  // Try to load native module for WebSocket, HTTP, Router, and Schema
  // Only do this if we didn't load a complete prebuild package
  if (!loadedPrebuild || !Object.values(nativeBindings).every(binding => binding !== null)) {
    tryLoadNativeFromPaths();
  }

  logLoadedBindings();
}

/**
 * Try to load platform-specific prebuilt packages
 * @returns True if any prebuilt package was loaded successfully
 */
function tryLoadPrebuiltPackages(): boolean {
  // First try platform-specific prebuilt packages using the require system
  const platformPrebuilds = [
    `nexurejs-native-${process.platform}-${process.arch}`
    // Additional platform-specific package names
  ];

  for (const prebuild of platformPrebuilds) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nativeModule = require(prebuild);
      logger.info(`Loaded prebuilt native module: ${prebuild}`);

      registerNativeComponents(nativeModule);
      return true;
    } catch (_error) {
      // Continue to next prebuild package
    }
  }

  return false;
}

/**
 * Register available components from a native module
 * @param nativeModule The loaded native module
 */
function registerNativeComponents(nativeModule: any): void {
  // Register components
  if (nativeModule.JSONParser || nativeModule.parse) {
    nativeBindings[BindingType.JSON_PARSER] = nativeModule;
  }

  if (nativeModule.Compression || nativeModule.compress) {
    nativeBindings[BindingType.COMPRESSION] = nativeModule;
  }

  if (nativeModule.NativeWebSocketServer) {
    nativeBindings[BindingType.WEBSOCKET] = nativeModule;
  }

  if (nativeModule.HTTPParser) {
    nativeBindings[BindingType.HTTP_PARSER] = nativeModule;
  }

  if (nativeModule.RadixRouter) {
    nativeBindings[BindingType.ROUTER] = nativeModule;
  }

  if (nativeModule.SchemaValidator) {
    nativeBindings[BindingType.SCHEMA] = nativeModule;
  }

  if (nativeModule.URLParser) {
    nativeBindings[BindingType.URL_PARSER] = nativeModule;
  }
}

/**
 * Load individual native modules
 */
function loadIndividualModules(): void {
  // Try to load common native binding modules
  tryLoadNativeBinding(BindingType.JSON_PARSER, 'simdjson');
  tryLoadNativeBinding(BindingType.COMPRESSION, 'zlib-sync');
  tryLoadNativeBinding(BindingType.CRYPTO, 'node-sodium');
  tryLoadNativeBinding(BindingType.URL_PARSER, 'fast-url-parser');
}

/**
 * Try to load native modules from various paths
 */
function tryLoadNativeFromPaths(): void {
  const nativePaths = [
    './build/Release/nexure_native.node',
    './build/Debug/nexure_native.node',
    './nexure_native.node',
    '../build/Release/nexure_native.node',
    '../build/Debug/nexure_native.node',
    '../nexure_native.node'
  ];

  // Try each path until one works
  for (const path of nativePaths) {
    try {
      if (existsSync(join(process.cwd(), path))) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const nativeModule = require(path);

        registerNativeComponents(nativeModule);

        // If we found any component, break the loop
        if (Object.values(nativeBindings).some(binding => binding !== null)) {
          break;
        }
      }
    } catch (_error) {
      // Continue to next path
    }
  }
}

/**
 * Log information about loaded bindings
 */
function logLoadedBindings(): void {
  const loadedModules = Object.entries(nativeBindings)
    .filter(([_, binding]) => binding !== null)
    .map(([type]) => type);

  if (loadedModules.length > 0) {
    logger.info(`Native bindings loaded: ${loadedModules.join(', ')}`);
  } else {
    logger.warn('No native bindings could be loaded, falling back to JavaScript implementations');
  }
}

/**
 * Clear the module cache
 * Useful for testing or reloading modules
 */
export function clearModuleCache(): void {
  Object.keys(moduleCache).forEach(key => {
    delete moduleCache[key];
  });

  // Reset bindings
  Object.keys(nativeBindings).forEach(key => {
    nativeBindings[key as BindingType] = null;
  });

  logger.debug('Native module cache cleared');
}

/**
 * Get performance metrics for native module operations
 */
export function getNativeBindingMetrics(): {
  loadAttempts: number;
  loadSuccesses: number;
  loadTime: number;
} {
  return {
    loadAttempts,
    loadSuccesses,
    loadTime: totalLoadTime
  };
}

/**
 * Reset performance metrics for native module operations
 */
export function resetNativeBindingMetrics(): void {
  loadAttempts = 0;
  loadSuccesses = 0;
  totalLoadTime = 0;
}
