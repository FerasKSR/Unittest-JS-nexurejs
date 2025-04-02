# NexureJS Build and Development Scripts

This directory contains the infrastructure scripts for NexureJS, including build tools, benchmarking, profiling, and release management.

## Unified Build Script

The `build.js` script is an all-in-one build tool that handles:

- TypeScript compilation
- Native module building for current platform
- Package creation for supported platforms
- Script generation for cross-platform builds
- Docker configuration for Linux builds
- GitHub Actions workflow generation
- Build directory cleaning
- Import paths fixing (previously separate fix-imports scripts)
- ESLint fixes and unused variable fixes
- Cross-platform package generation
- Native module installation and management

## Command Line Options

The unified script supports various command-line options:

```bash
# Full build process
node scripts/build.js

# Clean only
node scripts/build.js --clean-only

# Fix import paths only
node scripts/build.js --fix-imports-only

# Fix ESLint issues
node scripts/build.js --fix-lint-only

# Fix unused variables
node scripts/build.js --fix-unused-vars-only

# Fix all code issues
node scripts/build.js --fix-all

# Force rebuild of native modules
node scripts/build.js --force

# Package native modules
node scripts/build.js --pack-only

# Install native modules
node scripts/build.js --install-only

# Install in lite mode (JavaScript only)
node scripts/build.js --install-only --lite

# Generate unified build script
node scripts/build.js --create-unified-script

# Show help
node scripts/build.js --help
```

## NPM Scripts

The following npm scripts are available:

```bash
# === Build Scripts ===
# Full build
npm run build

# TypeScript build only
npm run build:ts

# Clean build directories
npm run clean

# Fix import paths
npm run fix:imports

# Fix ESLint issues
npm run fix:lint

# Fix unused variables
npm run fix:unused

# Fix all code issues
npm run fix:all

# Build native modules with force flag
npm run build:native

# Package native modules
npm run build:native:pack

# Install native modules
npm run install:native

# Install in lite mode (JavaScript only)
npm run install:lite

# Create a standalone build script for your platform
npm run build:script

# === Benchmark Scripts ===
# Run all benchmarks
npm run benchmark

# Run benchmarks and open dashboard
npm run benchmark:dashboard

# Run benchmarks as part of CI
npm run ci:benchmark

# === Profiling Scripts ===
# Run all profilers
npm run profile

# Run CPU profiling only
npm run profile:cpu

# Run memory profiling only
npm run profile:memory

# Run stream profiling only
npm run profile:stream

# Open profiling dashboard
npm run profile:dashboard

# === Release Scripts ===
# Create a new release
npm run release

# Create a patch release
npm run release:patch

# Create a minor release
npm run release:minor

# Create a major release
npm run release:major

# Prepare a pre-release
npm run release:pre
```

## Release Management

The `release.js` script handles the release process:

- Version bumping
- Changelog generation
- Git tagging
- NPM publishing
- GitHub release creation

To create a new release:

```bash
node scripts/release.js --type=patch|minor|major
```

## Benchmarking

NexureJS includes a comprehensive benchmarking system in `benchmarks/benchmarks.ts`. This file contains benchmarks for:

- Basic JavaScript operations
- HTTP request parsing
- Router performance
- JSON handling
- URL parsing
- Schema validation
- WebSocket operations
- Compression algorithms

Run benchmarks to measure performance:

```bash
# Run all benchmarks
npm run benchmark

# Open benchmark dashboard
npm run benchmark:dashboard
```

Benchmark results are saved to the `benchmark-results` directory as JSON files with timestamps, which can be loaded into the dashboard for visualization.

## Profiling

The profiling tools in the `profiling/` directory help identify performance bottlenecks:

- `profiler.js` - Contains CPU and memory profiling tools
- `data-generators.js` - Generates test data for profiling
- `run.js` - CLI interface for running profiling tests

Run profiling tools to analyze performance:

```bash
# Run all profilers
npm run profile

# Run specific profiling tests
npm run profile:cpu
npm run profile:memory
npm run profile:stream
```

## Installation Options

The build system provides flexible installation options:

- **Full Installation**: Includes native modules for maximum performance
- **Lite Mode**: JavaScript-only implementation for broader compatibility
- **Automatic Fallback**: When native modules can't be built, it falls back to JavaScript implementations
- **Prebuilt Binaries**: Downloads prebuilt modules when available for your platform

During installation, the script will:

1. Attempt to download prebuilt binaries for your platform
2. If unavailable, build native modules from source
3. Verify the modules work correctly
4. Fall back to JavaScript implementations if needed

## Platform Support

The build system supports these platforms:

- macOS (arm64, x64)
- Linux (x64)
- Windows (x64)

For cross-platform builds, the system will generate platform-specific build scripts that can be run on their respective platforms.

## Docker Support

If Docker is installed, the build system can create Docker-based builds for Linux platforms.

## CI/CD Integration

The build system generates GitHub Actions workflows for automated builds across all supported platforms.

## Script Architecture

All functionality that was previously spread across multiple scripts has been consolidated into unified scripts for easier maintenance and a more consistent developer experience.
