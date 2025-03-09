# Contributing to NexureJS

Thank you for your interest in contributing to NexureJS! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

Please be respectful and considerate of others when contributing to this project. We aim to foster an inclusive and welcoming community.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/nexurejs.git`
3. Install dependencies: `npm install`
4. Build the project: `npm run build`
5. Run tests: `npm test`

## Development Environment

### Prerequisites

- Node.js (v16 or later)
- npm or yarn
- C++ compiler (for native modules)
- node-gyp

### Building Native Modules

To build the native modules:

```bash
npm run build:native:test
```

This will compile the C++ code and verify that the native modules are working correctly.

## Pull Request Process

1. Create a new branch for your feature or bugfix: `git checkout -b feature/your-feature-name`
2. Make your changes
3. Add tests for your changes
4. Ensure all tests pass: `npm test`
5. Update documentation if necessary
6. Commit your changes with a descriptive commit message
7. Push to your fork: `git push origin feature/your-feature-name`
8. Submit a pull request to the main repository

## Coding Standards

- Follow the existing code style
- Use TypeScript for all new code
- Write comprehensive tests for new features
- Document public APIs
- Keep commits focused and atomic

## Working with Native Modules

When working with the native C++ modules:

1. Make sure you have the necessary build tools installed
2. Modify the C++ code in the `src/native` directory
3. Build and test your changes: `npm run build:native:test`
4. Ensure both the native and JavaScript implementations work correctly
5. Add benchmarks for performance-critical changes

## Testing

- Write unit tests for all new features
- Ensure existing tests pass with your changes
- Add integration tests for complex features
- Test both native and JavaScript implementations

## Documentation

- Update documentation for any changed functionality
- Document new features thoroughly
- Keep API documentation up-to-date
- Add examples for new features

## Reporting Bugs

When reporting bugs, please include:

- A clear description of the issue
- Steps to reproduce the problem
- Expected behavior
- Actual behavior
- Environment details (OS, Node.js version, etc.)
- Any relevant logs or error messages

## Feature Requests

Feature requests are welcome! Please provide:

- A clear description of the feature
- The motivation for adding this feature
- Any relevant examples or use cases

## Questions?

If you have any questions about contributing, please open an issue or reach out to the maintainers.

Thank you for contributing to NexureJS!
