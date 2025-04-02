#!/usr/bin/env node

/**
 * Release Validation Script
 *
 * This script validates whether the codebase is ready for release by checking:
 * - All tests pass
 * - No uncommitted changes
 * - Dependencies are up to date
 * - No security vulnerabilities
 * - No lint errors
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// ANSI color codes for console output
const Colors = {
  RESET: '\x1b[0m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  BOLD: '\x1b[1m'
};

// Check if we're running in CI mode
const isCI = process.env.CI === 'true';
const releaseType = process.env.RELEASE_TYPE || 'patch';

/**
 * Print a section header
 */
function printSectionHeader(title) {
  console.log(`\n${Colors.BLUE}${Colors.BOLD}${title}${Colors.RESET}`);
  console.log(`${Colors.BLUE}${'='.repeat(title.length)}${Colors.RESET}`);
}

/**
 * Run a command and return its output
 */
function runCommand(command, options = {}) {
  try {
    const output = execSync(command, {
      cwd: rootDir,
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
    return { success: true, output };
  } catch (error) {
    return {
      success: false,
      output: error.stdout || '',
      error: error.stderr || error.message
    };
  }
}

/**
 * Check if all tests pass
 */
async function validateTests() {
  printSectionHeader('Validating Tests');

  // Only run quick test validation in CI since the full test suite runs separately
  const testCommand = isCI
    ? 'npm run test:unit -- --silent'
    : 'npm test -- --silent';

  console.log(`Running tests: ${testCommand}`);
  const result = runCommand(testCommand, { silent: true });

  if (!result.success) {
    console.error(`${Colors.RED}Tests failed!${Colors.RESET}`);
    console.error(result.error);
    return false;
  }

  console.log(`${Colors.GREEN}All tests passed.${Colors.RESET}`);
  return true;
}

/**
 * Check if there are uncommitted changes
 */
async function validateGitStatus() {
  printSectionHeader('Validating Git Status');

  // In CI, we expect the repository to be clean
  const result = runCommand('git status --porcelain', { silent: true });

  if (result.output.trim() !== '') {
    if (isCI) {
      console.error(`${Colors.RED}Uncommitted changes detected:${Colors.RESET}`);
      console.error(result.output);
      return false;
    } else {
      console.warn(`${Colors.YELLOW}Warning: Uncommitted changes detected. These changes will not be included in the release.${Colors.RESET}`);
      console.warn(result.output);
    }
  } else {
    console.log(`${Colors.GREEN}Git working directory is clean.${Colors.RESET}`);
  }

  return true;
}

/**
 * Check if dependencies are up to date
 */
async function validateDependencies() {
  printSectionHeader('Validating Dependencies');

  // Check for outdated dependencies
  const result = runCommand('npm outdated --json', { silent: true });

  // npm outdated returns exit code 1 when there are outdated packages
  let outdatedPackages = {};
  try {
    if (result.output) {
      outdatedPackages = JSON.parse(result.output);
    }
  } catch (error) {
    console.error(`${Colors.RED}Failed to parse outdated packages:${Colors.RESET}`, error.message);
  }

  const outdatedCount = Object.keys(outdatedPackages).length;

  if (outdatedCount > 0) {
    console.warn(`${Colors.YELLOW}Warning: ${outdatedCount} outdated packages found.${Colors.RESET}`);

    // Filter to only show direct dependencies
    const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
    const directDeps = {
      ...packageJson.dependencies || {},
      ...packageJson.devDependencies || {}
    };

    const directOutdated = Object.keys(outdatedPackages)
      .filter(pkg => directDeps[pkg])
      .map(pkg => ({
        name: pkg,
        current: outdatedPackages[pkg].current,
        wanted: outdatedPackages[pkg].wanted,
        latest: outdatedPackages[pkg].latest
      }));

    if (directOutdated.length > 0) {
      console.warn(`${Colors.YELLOW}Direct dependencies that need updating:${Colors.RESET}`);
      directOutdated.forEach(pkg => {
        console.warn(`  ${pkg.name}: ${pkg.current} → ${pkg.wanted} (latest: ${pkg.latest})`);
      });
    }
  } else {
    console.log(`${Colors.GREEN}All dependencies are up to date.${Colors.RESET}`);
  }

  return true;
}

/**
 * Check for security vulnerabilities
 */
async function validateSecurity() {
  printSectionHeader('Validating Security');

  // Run npm audit
  const result = runCommand('npm audit --json', { silent: true });

  try {
    const auditData = JSON.parse(result.output);
    const vulnerabilitiesCount = auditData.metadata.vulnerabilities.total;

    if (vulnerabilitiesCount > 0) {
      const highSeverityCount =
        (auditData.metadata.vulnerabilities.high || 0) +
        (auditData.metadata.vulnerabilities.critical || 0);

      if (highSeverityCount > 0) {
        console.error(`${Colors.RED}High/Critical security vulnerabilities found: ${highSeverityCount}${Colors.RESET}`);

        // List high/critical vulnerabilities
        Object.values(auditData.vulnerabilities || {})
          .filter(vuln => ['high', 'critical'].includes(vuln.severity))
          .forEach(vuln => {
            console.error(`  ${vuln.name}: ${vuln.severity} severity (${vuln.url})`);
          });

        if (isCI) {
          return false;
        }
      } else {
        console.warn(`${Colors.YELLOW}Warning: ${vulnerabilitiesCount} low/moderate security vulnerabilities found.${Colors.RESET}`);
      }
    } else {
      console.log(`${Colors.GREEN}No security vulnerabilities found.${Colors.RESET}`);
    }
  } catch (error) {
    console.warn(`${Colors.YELLOW}Warning: Failed to parse npm audit results.${Colors.RESET}`);
  }

  return true;
}

/**
 * Check if there are lint errors
 */
async function validateLinting() {
  printSectionHeader('Validating Linting');

  const result = runCommand('npm run lint -- --max-warnings=0', { silent: true });

  if (!result.success) {
    console.warn(`${Colors.YELLOW}Warning: Linting issues found.${Colors.RESET}`);

    if (isCI) {
      console.error(`${Colors.RED}Lint errors prevent release in CI mode.${Colors.RESET}`);
      return false;
    }
  } else {
    console.log(`${Colors.GREEN}No linting issues found.${Colors.RESET}`);
  }

  return true;
}

/**
 * Validate that the release type is valid and meaningful
 */
async function validateReleaseType() {
  printSectionHeader('Validating Release Type');

  const validTypes = ['patch', 'minor', 'major', 'pre'];

  if (!validTypes.includes(releaseType)) {
    console.error(`${Colors.RED}Invalid release type: ${releaseType}${Colors.RESET}`);
    console.error(`${Colors.RED}Valid types are: ${validTypes.join(', ')}${Colors.RESET}`);
    return false;
  }

  // Check the current version and the impact of this release
  const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
  const currentVersion = packageJson.version;

  console.log(`${Colors.BLUE}Current version: ${currentVersion}${Colors.RESET}`);
  console.log(`${Colors.BLUE}Release type: ${releaseType}${Colors.RESET}`);

  // If it's a major version, provide extra warning
  if (releaseType === 'major') {
    console.warn(`${Colors.YELLOW}Warning: This is a MAJOR version bump which indicates breaking changes.${Colors.RESET}`);
    console.warn(`${Colors.YELLOW}Ensure that breaking changes are documented in the changelog.${Colors.RESET}`);
  }

  return true;
}

/**
 * Main function
 */
async function main() {
  console.log(`${Colors.BOLD}Validating release readiness for ${releaseType} release${Colors.RESET}`);

  // Run all validations
  const results = await Promise.all([
    validateReleaseType(),
    validateGitStatus(),
    validateTests(),
    validateDependencies(),
    validateSecurity(),
    validateLinting()
  ]);

  // Check if all validations passed
  const allPassed = results.every(result => result);

  if (allPassed) {
    console.log(`\n${Colors.GREEN}${Colors.BOLD}All validations passed! Ready for release.${Colors.RESET}`);
    process.exit(0);
  } else {
    console.error(`\n${Colors.RED}${Colors.BOLD}Some validations failed. Please fix the issues before releasing.${Colors.RESET}`);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error(`${Colors.RED}Error:${Colors.RESET}`, error);
  process.exit(1);
});
