# NexureJS Scripts

This folder contains optimized and minified script utilities for NexureJS development, building, and maintenance.

## Key Features

- **Optimized Performance**: All scripts have been optimized for faster execution
- **Memory Efficiency**: Scripts use efficient memory management and caching
- **Unified Interface**: Common script operations are available through a central runner
- **Minification Support**: Scripts can be minified for production use

## Main Scripts

### Script Runner

The `run-scripts.js` provides a unified interface to run various operations:

```bash
# Get help
node scripts/run-scripts.js help

# Run with specific commands
node scripts/run-scripts.js minify
node scripts/run-scripts.js benchmark http
node scripts/run-scripts.js lint --fix
node scripts/run-scripts.js build --watch
node scripts/run-scripts.js clean --all
```

### Script Minifier

The `minify-scripts.js` optimizes and minifies scripts for production:

```bash
# Run minification
node scripts/minify-scripts.js

# Dry run (shows what would be done)
node scripts/minify-scripts.js --dry-run

# Verbose output
node scripts/minify-scripts.js --verbose
```

### Lint Fixer

The `fix-lint-issues.js` automatically fixes common linting issues:

```bash
# Auto-fix linting issues
node scripts/fix-lint-issues.js

# Show what would be fixed without making changes
node scripts/fix-lint-issues.js --dry-run

# Show detailed output
node scripts/fix-lint-issues.js --verbose
```

## NPM Scripts

These scripts are also available through npm:

```bash
# Run the script runner
npm run scripts -- help

# Minify scripts
npm run scripts:minify

# Clean build artifacts
npm run scripts:clean

# Build TypeScript files
npm run scripts:build
```

## Performance Improvements

The script optimizations include:

1. **File Caching**: Avoids redundant file reads for better performance
2. **Single-Pass Processing**: Reduces the number of iterations through files
3. **Proper Error Handling**: Graceful error recovery and detailed error messages
4. **Memory Management**: Efficient data structures and garbage collection
5. **Minification**: Reduced file sizes for faster execution
6. **Shared Code**: Common utilities and functions are shared between scripts

## Development

When working on these scripts:

1. Use ES modules for better tree-shaking and optimization
2. Follow the established patterns for error handling and logging
3. Add proper JSDoc comments for documentation
4. Ensure backwards compatibility with existing scripts
5. Test both normal and error cases

## Minification Process

The minification process:

1. Preserves comments that include license/copyright notices
2. Keeps class and function names intact for debugging
3. Removes unused code and variables
4. Optimizes code for faster execution
5. Provides both minified and original versions

## Script Architecture

The scripts follow a modular architecture:

- **Core Runner**: Provides the central interface (`run-scripts.js`)
- **Task Modules**: Handle specific operations (lint, build, benchmark)
- **Utility Functions**: Shared across scripts for common operations
- **Configuration**: Centralized settings for consistent behavior
