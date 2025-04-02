/**
 * NexureJS Preinstall Script
 * This script runs before npm install to set up the environment for native module compilation
 */

import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execSync } from 'node:child_process';
import { platform } from 'node:os';
import { createRequire } from 'node:module';

// Get dirname equivalent in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const rootDir = join(__dirname, '..');
const isWindows = platform() === 'win32';
const isCIMode = process.env.NEXUREJS_CI_MODE === '1';

/**
 * Run a command and return its promise
 */
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      shell: true,
      stdio: 'inherit',
      ...options
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with exit code ${code}`));
        return;
      }
      resolve();
    });
  });
}

/**
 * Creates a simdjson.h file for platforms where the library doesn't work properly
 */
async function createSimdjsonStub() {
  console.log('Creating simdjson stub for compatibility...');

  const simdjsonDir = join(rootDir, 'src', 'native', 'json');
  const simdjsonHeader = join(simdjsonDir, 'simdjson.h');

  try {
    await fs.mkdir(simdjsonDir, { recursive: true });

    // Create a stub header file that defines the minimal necessary interfaces
    const headerContent = `
/**
 * Simdjson compatibility stub header
 * This is a minimal implementation to allow builds to succeed on platforms
 * where the simdjson library is not available or not working properly.
 */
#ifndef SIMDJSON_H
#define SIMDJSON_H

#include <string>
#include <vector>
#include <memory>

namespace simdjson {
    enum error_code {
        SUCCESS = 0,
        CAPACITY,
        MEMALLOC,
        TAPE_ERROR,
        DEPTH_ERROR,
        STRING_ERROR,
        T_ATOM_ERROR,
        F_ATOM_ERROR,
        N_ATOM_ERROR,
        NUMBER_ERROR,
        UTF8_ERROR,
        UNINITIALIZED,
        EMPTY,
        UNESCAPED_CHARS,
        UNCLOSED_STRING,
        UNSUPPORTED_ARCHITECTURE,
        INCORRECT_TYPE,
        NUMBER_OUT_OF_RANGE,
        INDEX_OUT_OF_BOUNDS,
        NO_SUCH_FIELD,
        IO_ERROR,
        INVALID_JSON_POINTER,
        INVALID_URI_FRAGMENT,
        UNEXPECTED_ERROR,
        PARSER_IN_USE,
        OUT_OF_ORDER_ITERATION,
        INSUFFICIENT_PADDING,
        INCOMPLETE_ARRAY_OR_OBJECT
    };

    class dom {
    public:
        class element;
        class parser;
        class document {
        public:
            element root() const { return element(); }
        };

        class element {
        public:
            element() {}
            bool is_object() const { return false; }
            bool is_array() const { return false; }
            bool is_string() const { return false; }
            bool is_int64() const { return false; }
            bool is_uint64() const { return false; }
            bool is_double() const { return false; }
            bool is_bool() const { return false; }
            bool is_null() const { return true; }

            int64_t get_int64() const { return 0; }
            uint64_t get_uint64() const { return 0; }
            double get_double() const { return 0.0; }
            bool get_bool() const { return false; }
            std::string_view get_string() const { return std::string_view(); }

            element operator[](std::string_view key) const { return element(); }
            element at(std::string_view key) const { return element(); }
            element at(size_t index) const { return element(); }

            size_t size() const { return 0; }
        };

        class parser {
        public:
            parser() {}
            error_code load(const std::string& json, document& doc) { return SUCCESS; }
            error_code parse(const std::string& json, document& doc) { return SUCCESS; }
        };
    };

    typedef dom DOM;

    namespace build {
        constexpr bool get_active_implementation() { return false; }
        constexpr bool simdjson_required() { return false; }
    }
}

#endif // SIMDJSON_H
`;

    await fs.writeFile(simdjsonHeader, headerContent);
    console.log('Created simdjson stub header successfully');
  } catch (err) {
    console.error('Error creating simdjson stub:', err);
    throw err;
  }
}

/**
 * Setup fallback mode for CI or when native builds are disabled
 */
async function setupFallbackMode() {
  console.log('Setting up fallback mode - native modules will be disabled');

  // Create fallback files
  try {
    // Create build directory if it doesn't exist
    const buildDir = join(rootDir, 'build');
    await fs.mkdir(buildDir, { recursive: true });

    // Create Release directory
    const releaseDir = join(buildDir, 'Release');
    await fs.mkdir(releaseDir, { recursive: true });

    // Create empty native module file as fallback
    const emptyModulePath = join(releaseDir, 'nexurejs_native.node');
    await fs.writeFile(emptyModulePath, Buffer.alloc(0));

    // Create flag file indicating fallback mode
    await fs.writeFile(join(buildDir, '.js_fallback'), JSON.stringify({
      platform: process.platform,
      arch: process.arch,
      timestamp: new Date().toISOString(),
      reason: 'CI mode enabled or native builds disabled'
    }, null, 2));

    console.log('Fallback mode set up successfully');
  } catch (err) {
    console.error('Failed to set up fallback mode:', err);
    throw err;
  }
}

/**
 * Check if we need to prepare for native build
 */
async function main() {
  try {
    console.log('Preparing environment for NexureJS native modules...');

    // Check if we're in CI mode
    if (isCIMode) {
      console.log('CI mode detected, skipping native module build');
      await setupFallbackMode();
      return;
    }

    // Create build directory if it doesn't exist
    const buildDir = join(rootDir, 'build');
    await fs.mkdir(buildDir, { recursive: true });

    // On Windows, we need to handle simdjson differently
    if (isWindows) {
      console.log('Windows platform detected, setting up compatibility layer...');
      await createSimdjsonStub();
    }

    // Create a flag file to indicate preinstall ran successfully
    await fs.writeFile(join(buildDir, '.preinstall-complete'), 'true');

    console.log('Preinstall completed successfully');
  } catch (err) {
    console.error('Preinstall failed:', err);
    process.exit(1);
  }
}

main();
