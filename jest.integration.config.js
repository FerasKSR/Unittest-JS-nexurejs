// Integration tests configuration with disabled coverage
import baseConfig from './jest.config.js';

export default {
  ...baseConfig,
  // Override only the necessary settings for integration tests
  testMatch: ['**/test/integration/**/*.test.ts'],
  // Disable coverage for integration tests by default to avoid ESM+coverage issues
  collectCoverage: process.env.COLLECT_COVERAGE === 'true',
  // Use a more compatible coverage provider for CI environments
  coverageProvider: 'babel',
  // Integration tests specific settings
  testTimeout: 30000, // Longer timeout for integration tests
  // Force Jest to use ESM
  globals: {
    // Add any integration-test specific global options here
  }
};
