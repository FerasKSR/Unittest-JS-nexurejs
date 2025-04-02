/**
 * Unit tests for the native module loader and status reporting
 */

import {
  getNativeModuleStatus,
  configureNativeModules,
  loadNativeBinding,
  NativeModuleOptions,
  NativeModuleStatus,
} from '../../../src/native/index.js'; // Adjust path as needed

describe('Native Module Loading and Status', () => {
  let initialStatus: NativeModuleStatus;

  beforeAll(() => {
    // Get the initial status before any tests modify configuration
    initialStatus = getNativeModuleStatus();
    console.log('Initial Native Module Status:', initialStatus);
  });

  test('should report native module status', () => {
    const status = getNativeModuleStatus();
    expect(status).toBeDefined();
    expect(typeof status.loaded).toBe('boolean');
    expect(typeof status.httpParser).toBe('boolean');
    expect(typeof status.radixRouter).toBe('boolean');
    expect(typeof status.jsonProcessor).toBe('boolean');
    expect(typeof status.urlParser).toBe('boolean');
    expect(typeof status.schemaValidator).toBe('boolean');
    expect(typeof status.compression).toBe('boolean');
    expect(typeof status.webSocket).toBe('boolean');
    expect(typeof status.objectPool).toBe('boolean');

    // Depending on the build environment, 'loaded' might be true or false.
    // We primarily check the structure here.
    if (status.error) {
      console.warn('Native module loading error reported:', status.error);
    }
  });

  test('should attempt to load native binding', () => {
    // Note: This relies on the native module being built beforehand.
    // The actual binding might be null if the build didn't run or failed.
    const binding = loadNativeBinding();

    // If the binding is loaded, the status should reflect it.
    const status = getNativeModuleStatus();
    if (binding) {
      expect(status.loaded).toBe(true);
      // Check for at least one expected native component
      expect(status.httpParser || status.radixRouter || status.jsonProcessor || status.webSocket).toBe(true);
    } else {
      expect(status.loaded).toBe(false);
      console.warn('Native binding could not be loaded during test. Ensure it is built.');
    }
  });

  test('should allow configuring native modules', () => {
    const initialOptions: NativeModuleOptions = {
      enabled: true,
      verbose: false,
      maxCacheSize: 1000,
    };
    const newOptions: NativeModuleOptions = {
      enabled: false, // Disable native modules
      verbose: true,
      maxCacheSize: 500,
    };

    // Configure with new options
    let currentOptions = configureNativeModules(newOptions);
    expect(currentOptions.enabled).toBe(false);
    expect(currentOptions.verbose).toBe(true);
    expect(currentOptions.maxCacheSize).toBe(500);

    // Check status reflects disabled state
    let status = getNativeModuleStatus();
    expect(status.loaded).toBe(false); // Should be false as native is disabled

    // Re-enable
    currentOptions = configureNativeModules(initialOptions);
    expect(currentOptions.enabled).toBe(true);

    // Status might reset, re-check loading
    status = getNativeModuleStatus();
    expect(typeof status.loaded).toBe('boolean');
  });

  // Add more tests for specific native components if needed
});
