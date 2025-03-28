/**
 * NexureJS Framework Setup
 *
 * This module initializes the framework and configures native modules
 * to be used by default for maximum performance.
 */

import { configureNativeModules, getNativeModuleStatus } from './native/index.js';
import { setUseNativeByDefault } from './utils/native-bindings.js';
import { Logger } from './utils/logger.js';
import { performance } from 'node:perf_hooks';

const logger = new Logger();

/**
 * Framework initialization options
 */
export interface SetupOptions {
  /**
   * Whether to enable native modules
   * @default true
   */
  enableNativeModules?: boolean;

  /**
   * Whether to force using native modules even when potentially incompatible
   * @default false
   */
  forceNativeModules?: boolean;

  /**
   * Whether to show verbose logging during initialization
   * @default false
   */
  verbose?: boolean;

  /**
   * Custom native module path to load
   */
  modulePath?: string;

  /**
   * Whether to initialize the framework immediately
   * @default true
   */
  initializeImmediately?: boolean;
}

/**
 * Initialize the framework with native modules
 *
 * @param options Framework initialization options
 * @returns Object containing initialization status
 */
export function initializeFramework(options: SetupOptions = {}): {
  nativeModulesEnabled: boolean;
  nativeModulesLoaded: boolean;
  availableModules: string[];
  initTime: number;
} {
  const startTime = performance.now();

  const {
    enableNativeModules = true,
    forceNativeModules = false,
    verbose = false,
    modulePath,
    initializeImmediately = true
  } = options;

  // Set native modules as the default
  setUseNativeByDefault(enableNativeModules);

  // Configure native modules
  if (enableNativeModules && initializeImmediately) {
    if (verbose) {
      logger.info('Initializing native modules...');
    }

    configureNativeModules({
      enabled: true,
      verbose,
      modulePath,
      // Additional options can be passed here
    });
  }

  // Get module status
  const status = getNativeModuleStatus();

  // Get available modules
  const availableModules = Object.entries(status)
    .filter(([key, value]) => key !== 'loaded' && value === true)
    .map(([key]) => key);

  // Get initialization time
  const endTime = performance.now();
  const initTime = endTime - startTime;

  if (verbose) {
    if (status.loaded) {
      logger.info(`Native modules loaded successfully in ${initTime.toFixed(2)}ms`);
      logger.info(`Available modules: ${availableModules.join(', ')}`);
    } else {
      logger.warn('Native modules could not be loaded, using JavaScript implementations');
      if (status.error) {
        logger.error(`Error loading native modules: ${status.error}`);
      }
    }
  }

  return {
    nativeModulesEnabled: enableNativeModules,
    nativeModulesLoaded: status.loaded,
    availableModules,
    initTime
  };
}

// Auto-initialize the framework if not in a testing environment
if (process.env.NODE_ENV !== 'test') {
  initializeFramework({
    enableNativeModules: true,
    verbose: process.env.DEBUG === 'true'
  });
}

export default {
  initializeFramework,
  getNativeModuleStatus
};
