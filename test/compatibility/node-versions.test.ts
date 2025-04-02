/**
 * Compatibility tests for Node.js version requirements
 */

import versionCheck from '../version-check.js';

describe('Node.js Version Compatibility', () => {

  test('should verify minimum Node.js version requirements', () => {
    expect(versionCheck.MIN_MAJOR).toBe(16);
    expect(versionCheck.MIN_MINOR).toBe(14);
    expect(versionCheck.MIN_PATCH).toBe(0);
  });

  test('should correctly detect current Node.js version', () => {
    expect(versionCheck.NODE_MAJOR_VERSION).toBeGreaterThanOrEqual(versionCheck.MIN_MAJOR);

    // If major version is the minimum, minor should be at least the minimum
    if (versionCheck.NODE_MAJOR_VERSION === versionCheck.MIN_MAJOR) {
      expect(versionCheck.NODE_MINOR_VERSION).toBeGreaterThanOrEqual(versionCheck.MIN_MINOR);

      // If major and minor versions are the minimum, patch should be at least the minimum
      if (versionCheck.NODE_MINOR_VERSION === versionCheck.MIN_MINOR) {
        expect(versionCheck.NODE_PATCH_VERSION).toBeGreaterThanOrEqual(versionCheck.MIN_PATCH);
      }
    }
  });
});
