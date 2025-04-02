export default {
  preset: 'ts-jest',
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
  coverageProvider: 'babel',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**/*',
    '!src/**/*.test.ts'
  ],
  testEnvironmentOptions: {
    url: 'http://localhost'
  }
};
