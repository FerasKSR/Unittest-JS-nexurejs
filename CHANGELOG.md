# Changelog

All notable changes to NexureJS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial documentation for native modules
- Performance metrics tracking for all native modules
- Comprehensive release documentation and process
- GitHub Actions workflows for automated releases and testing

### Fixed
- ES Module compatibility in build and installation scripts
- Native module building and loading in ES Module environment
- RadixRouter C++ code to use correct Node-API methods
- Installation and prebuild scripts for better cross-platform support

## [0.1.0] - 2023-11-15

### Added
- Initial release of NexureJS framework
- HTTP Parser native module for fast HTTP request parsing
- Radix Router native module for efficient route matching
- JSON Processor native module for high-performance JSON operations
- Basic server functionality with middleware support
- TypeScript support and type definitions
- Comprehensive documentation
- Example applications

### Changed
- Native modules are now enabled by default for maximum performance
- Default configuration includes maxCacheSize of 1000 for route caching

### Fixed
- HTTP Parser streaming functionality for handling large requests
- Native module loading path resolution for various environments
