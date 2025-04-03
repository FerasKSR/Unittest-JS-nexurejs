export default {
  preset: 'ts-jest/presets/js-with-ts-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.json'
      },
    ],
  },
  testMatch: [
    '**/test/unit/**/*.test.ts',
    '**/test/integration/**/*.test.ts',
    '**/test/compatibility/**/*.test.ts'
  ],
  collectCoverage: true,
  coverageDirectory: './coverage',
  coverageReporters: ['text', 'lcov', 'json'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  coverageProvider: 'v8',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**/*',
    '!src/**/*.test.ts'
  ],
  testEnvironmentOptions: {
    url: 'http://localhost'
  },
  // Force Jest to use ESM
  globals: {
    // 'ts-jest' config removed from here as it's already in the transform section
  },
  // Handle the .js extension properly in imports
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
