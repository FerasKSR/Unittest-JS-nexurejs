# NexureJS Testing Guide

This directory contains test files for the NexureJS framework. The tests are organized into four main categories:

## Test Categories

### 1. Unit Tests (`/unit`)
Unit tests focus on testing individual components, functions, or classes in isolation.

### 2. Integration Tests (`/integration`)
Integration tests verify that different parts of the framework work together properly.

### 3. Compatibility Tests (`/compatibility`)
Compatibility tests ensure the framework works correctly across different environments, Node.js versions, and with various dependencies.

### 4. Performance Tests (`/performance`)
Performance tests measure the framework's speed, responsiveness, and resource usage under different loads.

## Running Tests

To run all tests (excluding performance tests), use:
```bash
npm test
# or
npm run test:run
```

To run specific test categories:
```bash
# Run only unit tests
npm run test:unit
# or
npm run test:run -- --unit

# Run only integration tests
npm run test:integration
# or
npm run test:run -- --integration

# Run only compatibility tests
npm run test:compatibility
# or
npm run test:run -- --compatibility

# Run only performance tests
npm run test:perf
# or
npm run test:run -- --performance

# Run all tests including performance tests
npm run test:run -- --all
```

To run tests with code coverage:
```bash
npm run test:coverage
# or
npm run test:run -- --coverage
```

To run tests in watch mode (for development):
```bash
npm run test:watch
# or
npm run test:run -- --watch
```

## Global Test Setup

The global test setup is defined in `test/setup.ts`. This file:
1. Sets the environment to 'test'
2. Executes code before and after all tests
3. Provides global test utilities and mocks

## Test Utilities

### Mock Request/Response

We provide utility functions to create mock HTTP request and response objects:

```typescript
// Create a mock request object
const req = mockRequest({
  method: 'POST',
  url: '/api/users',
  body: { name: 'John Doe' }
});

// Create a mock response object
const res = mockResponse();

// Later in your test
expect(res.status).toHaveBeenCalledWith(201);
expect(res.json).toHaveBeenCalledWith({ id: 123, name: 'John Doe' });
```

## Writing Tests

### Test File Naming
All test files should follow the naming convention: `*.test.ts`

### Test Structure
Each test file should:
1. Import the module(s) to be tested
2. Set up any required mocks or fixtures
3. Group related tests in `describe` blocks
4. Use clear, descriptive test names
5. Clean up after tests when necessary

### Example Test Structure
```typescript
/**
 * Test description
 */

// Imports
import { SomeModule } from '@/path/to/module';

describe('Module Name', () => {
  let instance;

  beforeEach(() => {
    // Setup code
    instance = new SomeModule();
  });

  afterEach(() => {
    // Cleanup code
  });

  test('should do something specific', () => {
    // Test code
    const result = instance.someMethod();
    expect(result).toBe(expectedValue);
  });
});
```

## CI Integration

The test suite is integrated with our CI pipeline in GitHub Actions. On each pull request and push to main branches, the following steps are performed:
1. Tests are run across multiple platforms (Linux, macOS, Windows)
2. Tests are run with different Node.js versions (16.x, 18.x, 20.x)
3. Code coverage reports are generated and uploaded to Codecov

## Best Practices

1. **Keep tests focused**: Each test should verify one specific behavior
2. **Use descriptive names**: Test names should clearly describe what's being tested
3. **Avoid test interdependence**: Tests should be able to run independently
4. **Mock external dependencies**: Use Jest's mocking capabilities for external services
5. **Test edge cases**: Include tests for boundary conditions and error scenarios
6. **Maintain good coverage**: Aim for at least 70% code coverage in all modules
