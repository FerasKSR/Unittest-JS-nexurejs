# Contributing to NexureJS

Thank you for considering contributing to NexureJS! This document outlines the process for contributing to the project.

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## How Can I Contribute?

### Reporting Bugs

- Check if the bug has already been reported in the [Issues](https://github.com/nexurejs/nexurejs/issues)
- If not, create a new issue with a clear title and description
- Include steps to reproduce, expected behavior, and actual behavior
- Include code samples, error messages, and screenshots if applicable

### Suggesting Features

- Check if the feature has already been suggested in the [Issues](https://github.com/nexurejs/nexurejs/issues)
- If not, create a new issue with a clear title and description
- Explain why this feature would be useful to most NexureJS users

### Pull Requests

1. Fork the repository
2. Create a new branch for your changes
3. Make your changes
4. Run tests and ensure they pass
5. Submit a pull request

## Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/nexurejs/nexurejs.git
   cd nexurejs
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. Run tests:
   ```bash
   npm test
   ```

## Building Native Modules

To build the native modules:

```bash
npm run build:native
```

For development and testing:

```bash
npm run build:native:test
```

## Coding Standards

- Follow the existing code style
- Write tests for new features and bug fixes
- Document new features and changes
- Keep pull requests focused on a single topic

## Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Changes that do not affect the meaning of the code
- `refactor`: Code changes that neither fix a bug nor add a feature
- `perf`: Performance improvements
- `test`: Adding or fixing tests
- `chore`: Changes to the build process or auxiliary tools

Example:
```
feat: add support for HTTP/2
```

## Release Process

NexureJS follows [Semantic Versioning](https://semver.org/) for releases.

### Preparing a Release

1. Ensure all tests pass
2. Update the CHANGELOG.md with the changes in the new version
3. Update the version in package.json

### Creating a Release

For maintainers with release permissions:

```bash
# For patch releases (bug fixes)
npm run release:patch

# For minor releases (new features)
npm run release:minor

# For major releases (breaking changes)
npm run release:major

# For a specific version
npm run release 1.2.3
```

For detailed information about the release process, see [Release Documentation](./docs/releasing.md).

## License

By contributing to NexureJS, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
