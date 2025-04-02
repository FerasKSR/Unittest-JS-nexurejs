#!/usr/bin/env node

/**
 * Dependency Health Check
 *
 * This script checks for:
 * - Outdated dependencies
 * - Security vulnerabilities
 * - Duplicate dependencies
 * - Unused dependencies
 * - Missing peer dependencies
 *
 * It helps maintain a healthy and secure dependency tree.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

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
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m'
};

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  checkOutdated: true,
  checkVulnerabilities: true,
  checkDuplicates: true,
  checkUnused: false, // Disabled by default as it can be noisy
  checkPeers: true,
  update: args.includes('--update'),
  updateType: args.includes('--major') ? 'major' : (args.includes('--minor') ? 'minor' : 'patch'),
  json: args.includes('--json'),
  markdown: args.includes('--markdown'),
  fix: args.includes('--fix'),
  ci: args.includes('--ci')
};

// Initialize results
const results = {
  outdated: {},
  vulnerabilities: [],
  duplicates: [],
  unused: [],
  missingPeers: {}
};

/**
 * Run a command and return its output
 */
function runCommand(command, options = {}) {
  try {
    console.log(`${Colors.DIM}> ${command}${Colors.RESET}`);
    const output = execSync(command, {
      cwd: options.cwd || rootDir,
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
    return { success: true, output };
  } catch (error) {
    console.error(`${Colors.RED}Command failed: ${command}${Colors.RESET}`);
    return {
      success: false,
      output: error.stdout || '',
      error: error.stderr || error.message
    };
  }
}

/**
 * Print a section header
 */
function printSectionHeader(title) {
  if (options.json) return;
  console.log(`\n${Colors.CYAN}${Colors.BOLD}${title}${Colors.RESET}`);
  console.log(`${Colors.CYAN}${'='.repeat(title.length)}${Colors.RESET}`);
}

/**
 * Check for outdated dependencies
 */
async function checkOutdated() {
  printSectionHeader('Checking for outdated dependencies');

  try {
    const response = runCommand('npm outdated --json --long', { stdio: 'pipe', silent: true });

    if (!response.success) {
      // Parse the output as JSON if available
      if (response.output && response.output.trim()) {
        try {
          const outdatedDeps = JSON.parse(response.output);
          results.outdated = outdatedDeps;

          if (Object.keys(outdatedDeps).length === 0) {
            if (!options.json) console.log(`${Colors.GREEN}All dependencies are up to date!${Colors.RESET}`);
            return true;
          }

          if (!options.json) {
            console.log(`${Colors.YELLOW}Found ${Object.keys(outdatedDeps).length} outdated dependencies:${Colors.RESET}\n`);

            // Format the table
            console.log('Package'.padEnd(30) + 'Current'.padEnd(15) + 'Latest'.padEnd(15) + 'Type');
            console.log('-'.repeat(75));

            for (const [pkg, info] of Object.entries(outdatedDeps)) {
              console.log(
                `${pkg.padEnd(30)}${info.current.padEnd(15)}${info.latest.padEnd(15)}${info.type || 'unknown'}`
              );
            }

            if (options.update) {
              console.log(`\n${Colors.YELLOW}Updating dependencies...${Colors.RESET}`);

              for (const [pkg, info] of Object.entries(outdatedDeps)) {
                if (info.type === 'devDependencies') {
                  if (options.updateType === 'major' ||
                     (options.updateType === 'minor' && !isBreakingChange(info.current, info.latest)) ||
                     (options.updateType === 'patch' && isSameMajorMinor(info.current, info.latest))) {
                    console.log(`Updating ${pkg} from ${info.current} to ${info.latest}`);
                    runCommand(`npm install --save-dev ${pkg}@${info.latest}`);
                  }
                } else if (info.type === 'dependencies') {
                  if (options.updateType === 'major' ||
                     (options.updateType === 'minor' && !isBreakingChange(info.current, info.latest)) ||
                     (options.updateType === 'patch' && isSameMajorMinor(info.current, info.latest))) {
                    console.log(`Updating ${pkg} from ${info.current} to ${info.latest}`);
                    runCommand(`npm install --save ${pkg}@${info.latest}`);
                  }
                }
              }
            }
          }
        } catch (parseError) {
          if (!options.json) console.error(`${Colors.RED}Error parsing npm outdated output: ${parseError.message}${Colors.RESET}`);
          return false;
        }
      }
    } else {
      if (!options.json) console.log(`${Colors.GREEN}All dependencies are up to date!${Colors.RESET}`);
      return true;
    }
  } catch (error) {
    if (!options.json) console.error(`${Colors.RED}Error checking outdated packages: ${error.message}${Colors.RESET}`);
    return false;
  }
}

/**
 * Check if version change is breaking (different major)
 */
function isBreakingChange(currentVersion, latestVersion) {
  const current = parseVersion(currentVersion);
  const latest = parseVersion(latestVersion);

  return current.major !== latest.major;
}

/**
 * Check if versions have same major and minor
 */
function isSameMajorMinor(currentVersion, latestVersion) {
  const current = parseVersion(currentVersion);
  const latest = parseVersion(latestVersion);

  return current.major === latest.major && current.minor === latest.minor;
}

/**
 * Parse semver version
 */
function parseVersion(version) {
  const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/);
  if (!match) {
    return { major: 0, minor: 0, patch: 0 };
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || null,
    buildmetadata: match[5] || null
  };
}

/**
 * Check for security vulnerabilities
 */
async function checkVulnerabilities() {
  printSectionHeader('Checking for security vulnerabilities');

  try {
    const response = runCommand('npm audit --json', { stdio: 'pipe', silent: true });

    // npm audit returns non-zero exit if vulnerabilities found
    if (!response.success && response.output) {
      try {
        const auditData = JSON.parse(response.output);

        if (auditData.vulnerabilities) {
          const vulnCount = auditData.metadata?.vulnerabilities?.total || 0;

          if (vulnCount === 0) {
            if (!options.json) console.log(`${Colors.GREEN}No vulnerabilities found!${Colors.RESET}`);
            return true;
          }

          if (!options.json) {
            console.log(`${Colors.RED}Found ${vulnCount} vulnerabilities:${Colors.RESET}\n`);

            // Extract and store vulnerabilities
            for (const [pkg, vuln] of Object.entries(auditData.vulnerabilities)) {
              results.vulnerabilities.push({
                package: pkg,
                severity: vuln.severity,
                via: vuln.via,
                effects: vuln.effects,
                fixAvailable: !!vuln.fixAvailable
              });

              console.log(`${Colors.BOLD}${pkg}${Colors.RESET} - ${getColorBySeverity(vuln.severity)}${vuln.severity}${Colors.RESET}`);
              console.log(`  Vulnerable versions: ${vuln.range}`);
              if (vuln.fixAvailable) {
                console.log(`  ${Colors.GREEN}Fix available: ${vuln.fixAvailable.name}@${vuln.fixAvailable.version}${Colors.RESET}`);
              } else {
                console.log(`  ${Colors.YELLOW}No fix available${Colors.RESET}`);
              }
              console.log('');
            }

            // Offer to fix if enabled
            if (options.fix && auditData.metadata?.vulnerabilities?.fixable > 0) {
              console.log(`${Colors.YELLOW}Attempting to fix ${auditData.metadata.vulnerabilities.fixable} vulnerabilities...${Colors.RESET}`);
              runCommand('npm audit fix');
            }
          }
        } else {
          if (!options.json) console.log(`${Colors.GREEN}No vulnerabilities found!${Colors.RESET}`);
          return true;
        }
      } catch (parseError) {
        if (!options.json) console.error(`${Colors.RED}Error parsing npm audit output: ${parseError.message}${Colors.RESET}`);
        return false;
      }
    } else {
      if (!options.json) console.log(`${Colors.GREEN}No vulnerabilities found!${Colors.RESET}`);
      return true;
    }
  } catch (error) {
    if (!options.json) console.error(`${Colors.RED}Error checking vulnerabilities: ${error.message}${Colors.RESET}`);
    return false;
  }
}

/**
 * Get color code by severity
 */
function getColorBySeverity(severity) {
  switch (severity.toLowerCase()) {
    case 'critical': return Colors.RED + Colors.BOLD;
    case 'high': return Colors.RED;
    case 'moderate': return Colors.YELLOW;
    case 'low': return Colors.BLUE;
    default: return Colors.DIM;
  }
}

/**
 * Check for duplicate dependencies
 */
async function checkDuplicates() {
  printSectionHeader('Checking for duplicate dependencies');

  try {
    const response = runCommand('npm list --depth=0 --json', { stdio: 'pipe', silent: true });

    if (response.success && response.output) {
      try {
        const listData = JSON.parse(response.output);
        const depsData = runCommand('npm ls --all --json', { stdio: 'pipe', silent: true });

        if (depsData.success && depsData.output) {
          const allDeps = JSON.parse(depsData.output);
          const dependencies = {};

          // Helper function to recursively find duplicates
          function findDuplicates(deps, path = []) {
            if (!deps || typeof deps !== 'object') return;

            // Check dependencies
            if (deps.dependencies) {
              for (const [name, info] of Object.entries(deps.dependencies)) {
                const currentPath = [...path, name];
                if (!dependencies[name]) {
                  dependencies[name] = [{
                    version: info.version,
                    path: currentPath.join(' > ')
                  }];
                } else {
                  // Check if this is a different version
                  if (!dependencies[name].some(d => d.version === info.version)) {
                    dependencies[name].push({
                      version: info.version,
                      path: currentPath.join(' > ')
                    });
                  }
                }

                // Recurse
                findDuplicates(info, currentPath);
              }
            }
          }

          findDuplicates(allDeps);

          // Find packages with multiple versions
          const duplicates = Object.entries(dependencies)
            .filter(([_, versions]) => versions.length > 1)
            .map(([name, versions]) => ({
              name,
              versions: versions.map(v => ({ version: v.version, path: v.path }))
            }));

          results.duplicates = duplicates;

          if (duplicates.length === 0) {
            if (!options.json) console.log(`${Colors.GREEN}No duplicate dependencies found!${Colors.RESET}`);
            return true;
          }

          if (!options.json) {
            console.log(`${Colors.YELLOW}Found ${duplicates.length} dependencies with multiple versions:${Colors.RESET}\n`);

            for (const dup of duplicates) {
              console.log(`${Colors.BOLD}${dup.name}${Colors.RESET}`);
              for (const version of dup.versions) {
                console.log(`  ${version.version} - ${Colors.DIM}${version.path}${Colors.RESET}`);
              }
              console.log('');
            }

            if (options.fix) {
              console.log(`${Colors.YELLOW}Attempting to deduplicate dependencies...${Colors.RESET}`);
              runCommand('npm dedupe');
            }
          }
        }
      } catch (parseError) {
        if (!options.json) console.error(`${Colors.RED}Error parsing npm list output: ${parseError.message}${Colors.RESET}`);
        return false;
      }
    }
  } catch (error) {
    if (!options.json) console.error(`${Colors.RED}Error checking duplicates: ${error.message}${Colors.RESET}`);
    return false;
  }
}

/**
 * Check for unused dependencies
 */
async function checkUnused() {
  printSectionHeader('Checking for unused dependencies');

  try {
    // Check if depcheck is installed
    const hasDepcheck = runCommand('npx depcheck --version', { stdio: 'pipe', silent: true }).success;

    if (!hasDepcheck) {
      if (!options.json) console.log(`${Colors.YELLOW}depcheck not found, installing temporarily...${Colors.RESET}`);
      runCommand('npm install --no-save depcheck');
    }

    const response = runCommand('npx depcheck --json', { stdio: 'pipe', silent: true });

    if (response.success && response.output) {
      try {
        const depcheckData = JSON.parse(response.output);

        const unused = Object.keys(depcheckData.dependencies || {});
        const unusedDev = Object.keys(depcheckData.devDependencies || {});

        results.unused = [...unused, ...unusedDev];

        if (unused.length === 0 && unusedDev.length === 0) {
          if (!options.json) console.log(`${Colors.GREEN}No unused dependencies found!${Colors.RESET}`);
          return true;
        }

        if (!options.json) {
          if (unused.length > 0) {
            console.log(`${Colors.YELLOW}Found ${unused.length} unused dependencies:${Colors.RESET}`);
            unused.forEach(dep => console.log(`  - ${dep}`));
            console.log('');
          }

          if (unusedDev.length > 0) {
            console.log(`${Colors.YELLOW}Found ${unusedDev.length} unused dev dependencies:${Colors.RESET}`);
            unusedDev.forEach(dep => console.log(`  - ${dep}`));
            console.log('');
          }

          if (options.fix) {
            if (unused.length > 0) {
              console.log(`${Colors.YELLOW}Removing unused dependencies...${Colors.RESET}`);
              runCommand(`npm uninstall ${unused.join(' ')}`);
            }

            if (unusedDev.length > 0) {
              console.log(`${Colors.YELLOW}Removing unused dev dependencies...${Colors.RESET}`);
              runCommand(`npm uninstall ${unusedDev.join(' ')}`);
            }
          }
        }
      } catch (parseError) {
        if (!options.json) console.error(`${Colors.RED}Error parsing depcheck output: ${parseError.message}${Colors.RESET}`);
        return false;
      }
    }
  } catch (error) {
    if (!options.json) console.error(`${Colors.RED}Error checking unused dependencies: ${error.message}${Colors.RESET}`);
    return false;
  }
}

/**
 * Check for missing peer dependencies
 */
async function checkPeers() {
  printSectionHeader('Checking for missing peer dependencies');

  try {
    // Read package.json
    const packageJsonPath = path.join(rootDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    // Get dependencies
    const dependencies = {
      ...packageJson.dependencies || {},
      ...packageJson.devDependencies || {}
    };

    const missingPeerDeps = {};
    const peersToInstall = [];

    // For each dependency, check for peer dependencies
    for (const [pkg, version] of Object.entries(dependencies)) {
      try {
        // Get metadata from npm registry
        const pkgInfo = await getNpmPackageInfo(pkg);

        if (pkgInfo && pkgInfo.peerDependencies) {
          for (const [peerPkg, peerVersion] of Object.entries(pkgInfo.peerDependencies)) {
            if (!dependencies[peerPkg]) {
              if (!missingPeerDeps[pkg]) {
                missingPeerDeps[pkg] = [];
              }

              missingPeerDeps[pkg].push({ name: peerPkg, version: peerVersion });
              peersToInstall.push(`${peerPkg}@${peerVersion}`);
            }
          }
        }
      } catch (error) {
        if (!options.json) console.error(`${Colors.YELLOW}Error checking peer deps for ${pkg}: ${error.message}${Colors.RESET}`);
      }
    }

    results.missingPeers = missingPeerDeps;

    if (Object.keys(missingPeerDeps).length === 0) {
      if (!options.json) console.log(`${Colors.GREEN}No missing peer dependencies found!${Colors.RESET}`);
      return true;
    }

    if (!options.json) {
      console.log(`${Colors.YELLOW}Found missing peer dependencies:${Colors.RESET}\n`);

      for (const [pkg, peers] of Object.entries(missingPeerDeps)) {
        console.log(`${Colors.BOLD}${pkg}${Colors.RESET} requires:`);
        peers.forEach(peer => {
          console.log(`  - ${peer.name}@${peer.version}`);
        });
        console.log('');
      }

      if (options.fix && peersToInstall.length > 0) {
        console.log(`${Colors.YELLOW}Installing missing peer dependencies...${Colors.RESET}`);
        runCommand(`npm install --save-dev ${peersToInstall.join(' ')}`);
      }
    }
  } catch (error) {
    if (!options.json) console.error(`${Colors.RED}Error checking peer dependencies: ${error.message}${Colors.RESET}`);
    return false;
  }
}

/**
 * Get package info from npm registry
 */
function getNpmPackageInfo(packageName) {
  return new Promise((resolve, reject) => {
    const url = `https://registry.npmjs.org/${packageName}`;

    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const packageData = JSON.parse(data);
          const latestVersion = packageData['dist-tags']?.latest;

          if (latestVersion && packageData.versions && packageData.versions[latestVersion]) {
            resolve(packageData.versions[latestVersion]);
          } else {
            resolve(null);
          }
        } catch (e) {
          reject(new Error(`Failed to parse package data for ${packageName}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Generate Markdown report
 */
function generateMarkdownReport() {
  let markdown = '# Dependency Health Check Report\n\n';

  // Outdated dependencies
  markdown += '## Outdated Dependencies\n\n';
  if (Object.keys(results.outdated).length === 0) {
    markdown += 'No outdated dependencies found. ✅\n\n';
  } else {
    markdown += '| Package | Current | Latest | Type |\n';
    markdown += '| ------- | ------- | ------ | ---- |\n';

    for (const [pkg, info] of Object.entries(results.outdated)) {
      markdown += `| ${pkg} | ${info.current} | ${info.latest} | ${info.type || 'unknown'} |\n`;
    }

    markdown += '\n';
  }

  // Vulnerabilities
  markdown += '## Security Vulnerabilities\n\n';
  if (results.vulnerabilities.length === 0) {
    markdown += 'No security vulnerabilities found. ✅\n\n';
  } else {
    markdown += '| Package | Severity | Fix Available |\n';
    markdown += '| ------- | -------- | ------------- |\n';

    for (const vuln of results.vulnerabilities) {
      markdown += `| ${vuln.package} | ${vuln.severity} | ${vuln.fixAvailable ? '✅' : '❌'} |\n`;
    }

    markdown += '\n';
  }

  // Duplicates
  markdown += '## Duplicate Dependencies\n\n';
  if (results.duplicates.length === 0) {
    markdown += 'No duplicate dependencies found. ✅\n\n';
  } else {
    for (const dup of results.duplicates) {
      markdown += `### ${dup.name}\n\n`;
      markdown += '| Version | Path |\n';
      markdown += '| ------- | ---- |\n';

      for (const version of dup.versions) {
        markdown += `| ${version.version} | ${version.path} |\n`;
      }

      markdown += '\n';
    }
  }

  // Unused dependencies
  markdown += '## Unused Dependencies\n\n';
  if (results.unused.length === 0) {
    markdown += 'No unused dependencies found. ✅\n\n';
  } else {
    markdown += '- ' + results.unused.join('\n- ') + '\n\n';
  }

  // Missing peer dependencies
  markdown += '## Missing Peer Dependencies\n\n';
  if (Object.keys(results.missingPeers).length === 0) {
    markdown += 'No missing peer dependencies found. ✅\n\n';
  } else {
    for (const [pkg, peers] of Object.entries(results.missingPeers)) {
      markdown += `### ${pkg} requires:\n\n`;
      markdown += '- ' + peers.map(p => `${p.name}@${p.version}`).join('\n- ') + '\n\n';
    }
  }

  return markdown;
}

/**
 * Main function
 */
async function main() {
  if (options.json) {
    console.log = () => {}; // Suppress console output in JSON mode
  } else {
    console.log(`${Colors.BOLD}Dependency Health Check${Colors.RESET}`);
    console.log(`${Colors.DIM}Checking package dependencies for issues...${Colors.RESET}\n`);
  }

  // Run checks
  if (options.checkOutdated) await checkOutdated();
  if (options.checkVulnerabilities) await checkVulnerabilities();
  if (options.checkDuplicates) await checkDuplicates();
  if (options.checkUnused) await checkUnused();
  if (options.checkPeers) await checkPeers();

  // Output results
  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
  } else if (options.markdown) {
    const markdown = generateMarkdownReport();
    console.log(markdown);

    // Write to file
    fs.writeFileSync(path.join(rootDir, 'dependency-report.md'), markdown);
    console.log(`\n${Colors.GREEN}Report written to dependency-report.md${Colors.RESET}`);
  } else {
    printSectionHeader('Summary');

    console.log(`${Colors.BOLD}Outdated dependencies:${Colors.RESET} ${Object.keys(results.outdated).length}`);
    console.log(`${Colors.BOLD}Security vulnerabilities:${Colors.RESET} ${results.vulnerabilities.length}`);
    console.log(`${Colors.BOLD}Duplicate dependencies:${Colors.RESET} ${results.duplicates.length}`);
    console.log(`${Colors.BOLD}Unused dependencies:${Colors.RESET} ${results.unused.length}`);
    console.log(`${Colors.BOLD}Missing peer dependencies:${Colors.RESET} ${Object.keys(results.missingPeers).length}`);

    if (options.ci) {
      // Set exit code for CI
      if (results.vulnerabilities.length > 0 ||
          Object.keys(results.missingPeers).length > 0) {
        process.exit(1);
      }
    }
  }
}

main().catch(error => {
  console.error(`${Colors.RED}Error: ${error.message}${Colors.RESET}`);
  process.exit(1);
});
