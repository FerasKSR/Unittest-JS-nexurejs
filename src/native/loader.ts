/**
 * Native module loader
 *
 * This module handles the loading of native C++ modules with graceful fallback
 * to JavaScript implementations when native modules are not available.
 */

import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
import { Logger, LogLevel } from '../utils/logger';

// Create a require function for ESM
const require = createRequire(import.meta.url);

// Define binding types
export enum BindingType {
  WEBSOCKET = 'websocket',
  JSON = 'json',
  HTTP = 'http',
  URL = 'url',
  CRYPTO = 'crypto',
  COMPRESSION = 'compression',
  ROUTER = 'router',
  SCHEMA = 'schema'
}

// Define binding module interface
export interface NativeBindingModule {
  [key: string]: any;
}

// Module cache to prevent redundant loading attempts
const moduleCache: Record<string, any> = {};

// Create a logger
const nativeLoaderLogger = new Logger({
  enabled: process.env.NEXURE_NATIVE_DEBUG === 'true',
  level: LogLevel.DEBUG
});

/**
 * Try to load a native binding module
 * @param bindingPath The path to the binding module
 * @returns The loaded module or null if not found
 */
export function tryLoadNativeBinding(bindingPath: string): NativeBindingModule | null {
  // Check if module is already cached
  if (moduleCache[bindingPath] !== undefined) {
    return moduleCache[bindingPath];
  }

  try {
    const startTime = performance.now();
    // Try to load the module
    const nativeBindingPath = join(process.cwd(), bindingPath);

    // Check if the file exists
    if (!existsSync(nativeBindingPath)) {
      nativeLoaderLogger.debug(`Native binding module not found at: ${nativeBindingPath}`);
      moduleCache[bindingPath] = null;
      return null;
    }

    // Try to load the module
    const nativeBinding = require(nativeBindingPath);

    const endTime = performance.now();
    nativeLoaderLogger.debug(
      `Native binding loaded successfully in ${(endTime - startTime).toFixed(2)}ms: ${bindingPath}`
    );

    // Cache the loaded module
    moduleCache[bindingPath] = nativeBinding;
    return nativeBinding;
  } catch (error: any) {
    nativeLoaderLogger.warn(`Failed to load native binding: ${bindingPath}`, error.message);

    // Cache the failure
    moduleCache[bindingPath] = null;
    return null;
  }
}

/**
 * Load and cache native binding modules
 * @param modulePath Optional specific path to load from
 * @returns Loaded native modules or null if not available
 */
export function loadNativeBinding(modulePath?: string): NativeBindingModule | null {
  const paths = [
    // If a specific path is provided, try it first
    modulePath,
    // Try loading from various possible locations
    './build/Release/nexurejs_native.node',
    './build/Debug/nexurejs_native.node',
    './nexurejs_native.node',
    '../build/Release/nexurejs_native.node',
    '../build/Debug/nexurejs_native.node',
    '../nexurejs_native.node'
  ].filter(Boolean) as string[];

  // Try each path until one works
  for (const path of paths) {
    const module = tryLoadNativeBinding(path);
    if (module) {
      // Set debug level for native module (if available)
      if (module.setDebugLevel) {
        module.setDebugLevel(process.env.NEXURE_NATIVE_DEBUG === 'true' ? 1 : 0);
      }
      return module;
    }
  }

  // If we get here, no modules could be loaded
  nativeLoaderLogger.warn('No native bindings could be loaded, using JavaScript fallbacks');
  return null;
}

/**
 * Check if a specific binding type is available
 * @param bindingType The binding type to check
 * @returns True if the binding is available
 */
export function isBindingAvailable(bindingType: BindingType): boolean {
  const nativeModule = loadNativeBinding();

  if (!nativeModule) {
    return false;
  }

  switch (bindingType) {
    case BindingType.WEBSOCKET:
      return Boolean(nativeModule.NativeWebSocketServer);
    case BindingType.JSON:
      return Boolean(nativeModule.JSONParser);
    case BindingType.HTTP:
      return Boolean(nativeModule.HTTPParser);
    case BindingType.URL:
      return Boolean(nativeModule.URLParser);
    case BindingType.CRYPTO:
      return Boolean(nativeModule.Crypto);
    case BindingType.COMPRESSION:
      return Boolean(nativeModule.Compression);
    case BindingType.ROUTER:
      return Boolean(nativeModule.RadixRouter);
    case BindingType.SCHEMA:
      return Boolean(nativeModule.SchemaValidator);
    default:
      return false;
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
  nativeLoaderLogger.debug('Native module cache cleared');
}

/**
 * Get performance metrics for native module operations
 */
export function getNativeLoaderMetrics(): {
  loadAttempts: number;
  loadSuccesses: number;
  loadTime: number;
} {
  // This would normally track actual metrics, but for now just returns placeholders
  return {
    loadAttempts: Object.keys(moduleCache).length,
    loadSuccesses: Object.values(moduleCache).filter(Boolean).length,
    loadTime: 0 // Would track actual load time in a real implementation
  };
}

/**
 * Reset performance metrics for native module operations
 */
export function resetNativeLoaderMetrics(): void {
  // In a real implementation, this would reset counters
}
