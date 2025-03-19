#!/usr/bin/env node

/**
 * NexureJS Release Script
 *
 * This script automates the release process for NexureJS.
 * It handles version bumping, changelog updates, git tagging, GitHub releases,
 * uploading prebuilt binaries, and publishing to npm.
 *
 * Usage:
 *   node scripts/release.js [major|minor|patch|<version>] [--dry-run]
 *
 * Examples:
 *   node scripts/release.js patch     # Bump patch version (0.0.x)
 *   node scripts/release.js minor     # Bump minor version (0.x.0)
 *   node scripts/release.js major     # Bump major version (x.0.0)
 *   node scripts/release.js 1.2.3     # Set specific version
 *   node scripts/release.js           # Interactive mode
 *   node scripts/release.js patch --dry-run  # Dry run (no changes made)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import readline from 'readline';
import { fileURLToPath } from 'url';
import https from 'https';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to execute shell commands
function exec(command, options = {}) {
  console.log(`${colors.dim}> ${command}${colors.reset}`);
  return execSync(command, {
    stdio: options.silent ? 'pipe' : 'inherit',
    encoding: 'utf-8',
    ...options
  });
}

// Helper function to prompt for user input
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Helper function to get package info from package.json
function getPackageInfo() {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  return packageJson;
}

// Helper function to validate version format
function isValidVersion(version) {
  return /^\d+\.\d+\.\d+$/.test(version);
}

// Helper function to get the current version from package.json
function getCurrentVersion() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  return packageJson.version;
}

// Helper function to update version in package.json
function updateVersion(newVersion) {
  console.log(`${colors.blue}Updating version to ${newVersion}...${colors.reset}`);
  exec(`npm version ${newVersion} --no-git-tag-version`);
}

// Helper function to update the changelog
async function updateChangelog(newVersion) {
  console.log(`${colors.blue}Updating CHANGELOG.md...${colors.reset}`);

  const changelogPath = path.join(process.cwd(), 'docs', 'CHANGELOG.md');
  let changelog = fs.readFileSync(changelogPath, 'utf-8');

  // Get the date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  // Replace [Unreleased] with the new version
  const newChangelog = changelog.replace(
    '## [Unreleased]',
    `## [Unreleased]\n\n### Added\n- \n\n## [${newVersion}] - ${today}`
  );

  fs.writeFileSync(changelogPath, newChangelog, 'utf-8');

  // Open the changelog for editing
  console.log(`${colors.yellow}Please review and edit the CHANGELOG.md file in the docs folder.${colors.reset}`);

  // Wait for user to confirm they've edited the changelog
  await prompt(`${colors.bright}Press Enter when you've finished editing the CHANGELOG.md file...${colors.reset}`);
}

// Helper function to commit changes
function commitChanges(version) {
  console.log(`${colors.blue}Committing changes...${colors.reset}`);
  exec('git add package.json package-lock.json docs/CHANGELOG.md');
  exec(`git commit -m "chore: release v${version}"`);
}

// Helper function to create and push git tag
function createAndPushTag(version) {
  console.log(`${colors.blue}Creating and pushing git tag...${colors.reset}`);
  exec(`git tag -a v${version} -m "Release v${version}"`);
  exec('git push --delete origin main --tags');
  exec('git push origin main --tags');
}

// Helper function to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsedData = JSON.parse(responseData);
            resolve(parsedData);
          } catch (error) {
            resolve(responseData);
          }
        } else {
          reject(new Error(`HTTP Error: ${res.statusCode} - ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }

    req.end();
  });
}

// Helper function to upload assets to GitHub release
async function uploadReleaseAssets(release, assetPaths) {
  console.log(`${colors.blue}Uploading assets to GitHub release...${colors.reset}`);

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is not set');
  }

  const uploadUrl = release.upload_url.replace(/{.*}/, '');
  const successfulUploads = [];
  const failedUploads = [];

  for (const assetPath of assetPaths) {
    const assetName = path.basename(assetPath);
    console.log(`${colors.dim}Uploading ${assetName}...${colors.reset}`);

    let success = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const fileData = fs.readFileSync(assetPath);
        const contentType = 'application/octet-stream';

        const options = {
          hostname: new URL(uploadUrl).hostname,
          path: `${new URL(uploadUrl).pathname}?name=${encodeURIComponent(assetName)}`,
          method: 'POST',
          headers: {
            'Content-Type': contentType,
            'Content-Length': fileData.length,
            'User-Agent': 'NexureJS-Release-Script',
            'Authorization': `token ${token}`
          },
          timeout: 30000
        };

        await new Promise((resolve, reject) => {
          const req = https.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
              responseData += chunk;
            });

            res.on('end', () => {
              if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve(responseData);
              } else {
                reject(new Error(`HTTP Error: ${res.statusCode} - ${responseData}`));
              }
            });
          });

          req.on('error', reject);

          req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timed out'));
          });

          const chunkSize = 1024 * 1024;
          for (let i = 0; i < fileData.length; i += chunkSize) {
            const end = Math.min(i + chunkSize, fileData.length);
            req.write(fileData.slice(i, end));
          }

          req.end();
        });

        console.log(`${colors.green}Uploaded ${assetName} successfully!${colors.reset}`);
        success = true;
        successfulUploads.push(assetName);
        break;
      } catch (error) {
        if (attempt < 3) {
          console.log(`${colors.yellow}Attempt ${attempt} failed for ${assetName}: ${error.message}. Retrying...${colors.reset}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        } else {
          console.log(`${colors.red}Failed to upload ${assetName} after ${attempt} attempts: ${error.message}${colors.reset}`);
          failedUploads.push(assetName);
        }
      }
    }
  }

  if (successfulUploads.length > 0) {
    console.log(`\n${colors.green}Successfully uploaded ${successfulUploads.length} assets:${colors.reset}`);
    successfulUploads.forEach(asset => console.log(`${colors.green}- ${asset}${colors.reset}`));
  }

  if (failedUploads.length > 0) {
    console.log(`\n${colors.red}Failed to upload ${failedUploads.length} assets:${colors.reset}`);
    failedUploads.forEach(asset => console.log(`${colors.red}- ${asset}${colors.reset}`));
    console.log(`\n${colors.yellow}You can manually upload the failed assets at:${colors.reset}`);
    console.log(`${colors.yellow}${release.html_url}/assets/upload${colors.reset}`);
  }

  return {
    successCount: successfulUploads.length,
    failureCount: failedUploads.length,
    release
  };
}

// Helper function to create GitHub release
async function createGitHubRelease(version) {
  console.log(`${colors.blue}Creating GitHub release...${colors.reset}`);

  // Get GitHub token from environment variable
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is not set');
  }

  // Get repository info from package.json
  const packageInfo = getPackageInfo();
  const repoUrl = packageInfo.repository?.url || '';
  const repoMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);

  if (!repoMatch) {
    throw new Error('Could not determine GitHub repository from package.json');
  }

  const [, owner, repo] = repoMatch;

  // Extract release notes from CHANGELOG.md
  const changelog = fs.readFileSync(path.join(process.cwd(), 'docs', 'CHANGELOG.md'), 'utf-8');
  const releaseNotesRegex = new RegExp(`## \\[${version}\\].*?\\n(.*?)\\n## \\[`, 's');
  const match = changelog.match(releaseNotesRegex);

  let releaseNotes = '';
  if (match && match[1]) {
    releaseNotes = match[1].trim();
  } else {
    console.log(`${colors.yellow}Could not extract release notes from docs/CHANGELOG.md${colors.reset}`);
    releaseNotes = await prompt(`${colors.bright}Please enter release notes:${colors.reset}`);
  }

  // Create release
  const releaseData = {
    tag_name: `v${version}`,
    name: `NexureJS v${version}`,
    body: releaseNotes,
    draft: false,
    prerelease: false
  };

  const options = {
    hostname: 'api.github.com',
    path: `/repos/${owner}/${repo}/releases`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'NexureJS-Release-Script',
      'Authorization': `token ${token}`
    }
  };

  try {
    const release = await makeRequest(options, releaseData);
    console.log(`${colors.green}GitHub release created successfully!${colors.reset}`);

    // Upload prebuilt binaries if they exist
    const prebuildsDir = path.join(process.cwd(), 'prebuilds');
    if (fs.existsSync(prebuildsDir)) {
      const assetPaths = fs.readdirSync(prebuildsDir)
        .filter(file => file.endsWith('.tar.gz'))
        .map(file => path.join(prebuildsDir, file));

      if (assetPaths.length > 0) {
        const uploadResult = await uploadReleaseAssets(release, assetPaths);
        if (uploadResult.failureCount > 0) {
          console.log(`${colors.yellow}Some assets failed to upload. Please upload them manually.${colors.reset}`);
        }
      }
    }

    return release;
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log(`${colors.yellow}Release for v${version} already exists.${colors.reset}`);

      // Get the existing release
      const getOptions = {
        hostname: 'api.github.com',
        path: `/repos/${owner}/${repo}/releases/tags/v${version}`,
        method: 'GET',
        headers: {
          'User-Agent': 'NexureJS-Release-Script',
          'Authorization': `token ${token}`
        }
      };

      const release = await makeRequest(getOptions);
      return release;
    }

    throw error;
  }
}

// Helper function to publish to npm
async function publishToNpm() {
  const shouldPublish = await prompt(`${colors.bright}Do you want to publish to npm? (y/N)${colors.reset} `);

  if (shouldPublish.toLowerCase() === 'y') {
    console.log(`${colors.blue}Publishing to npm...${colors.reset}`);

    try {
      // Check if user is logged in to npm
      exec('npm whoami', { silent: true });
      console.log(`${colors.green}You are logged in to npm.${colors.reset}`);
    } catch (error) {
      console.log(`${colors.yellow}You are not logged in to npm. Please login:${colors.reset}`);
      exec('npm login');
    }

    // Publish to npm
    try {
      exec('npm publish');
      console.log(`${colors.green}Successfully published to npm!${colors.reset}`);
    } catch (error) {
      if (error.message.includes('You cannot publish over the previously published versions')) {
        console.log(`${colors.yellow}Package version is already published to npm.${colors.reset}`);
      } else {
        throw error;
      }
    }
  } else {
    console.log(`${colors.yellow}Skipping npm publish.${colors.reset}`);
  }
}

// Main function
async function main() {
  try {
    console.log(`${colors.bright}${colors.magenta}NexureJS Release Script${colors.reset}\n`);

    // Check for help flag
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      console.log(`${colors.bright}Usage:${colors.reset}`);
      console.log(`  node scripts/release.js [major|minor|patch|<version>] [--dry-run]`);
      console.log(`\n${colors.bright}Examples:${colors.reset}`);
      console.log(`  node scripts/release.js patch     # Bump patch version (0.0.x)`);
      console.log(`  node scripts/release.js minor     # Bump minor version (0.x.0)`);
      console.log(`  node scripts/release.js major     # Bump major version (x.0.0)`);
      console.log(`  node scripts/release.js 1.2.3     # Set specific version`);
      console.log(`  node scripts/release.js           # Interactive mode`);
      console.log(`  node scripts/release.js patch --dry-run  # Dry run (no changes made)`);
      process.exit(0);
    }

    // Check for dry run flag
    const isDryRun = process.argv.includes('--dry-run');
    if (isDryRun) {
      console.log(`${colors.yellow}DRY RUN MODE: No changes will be made${colors.reset}\n`);
    }

    // Check if git is clean
    try {
      const status = exec('git status --porcelain', { silent: true });
      if (status.trim() !== '' && !isDryRun) {
        console.log(`${colors.red}Error: Working directory is not clean. Please commit or stash your changes.${colors.reset}`);
        process.exit(1);
      } else if (status.trim() !== '' && isDryRun) {
        console.log(`${colors.yellow}Warning: Working directory is not clean. This would fail in a real release.${colors.reset}`);
      }
    } catch (error) {
      console.log(`${colors.red}Error: Failed to check git status.${colors.reset}`);
      process.exit(1);
    }

    // Check if on main branch
    try {
      const branch = exec('git rev-parse --abbrev-ref HEAD', { silent: true }).trim();
      if (branch !== 'main') {
        console.log(`${colors.yellow}Warning: You are not on the main branch. Current branch: ${branch}${colors.reset}`);
        const proceed = await prompt(`${colors.bright}Do you want to proceed anyway? (y/N)${colors.reset} `);
        if (proceed.toLowerCase() !== 'y') {
          process.exit(0);
        }
      }
    } catch (error) {
      console.log(`${colors.red}Error: Failed to check current branch.${colors.reset}`);
      process.exit(1);
    }

    // Pull latest changes
    console.log(`${colors.blue}Pulling latest changes from remote...${colors.reset}`);
    exec('git pull origin main');

    // Get current version
    const currentVersion = getCurrentVersion();
    console.log(`${colors.blue}Current version: ${currentVersion}${colors.reset}`);

    // Determine new version
    let newVersion = process.argv.find(arg => !arg.startsWith('-') && !arg.includes('/') && arg !== 'scripts/release.js');

    if (!newVersion) {
      // Interactive mode
      console.log(`${colors.bright}Available version bumps:${colors.reset}`);
      const [major, minor, patch] = currentVersion.split('.').map(Number);
      console.log(`  ${colors.green}major${colors.reset}: ${major + 1}.0.0`);
      console.log(`  ${colors.green}minor${colors.reset}: ${major}.${minor + 1}.0`);
      console.log(`  ${colors.green}patch${colors.reset}: ${major}.${minor}.${patch + 1}`);

      newVersion = await prompt(`${colors.bright}Enter version bump (major/minor/patch) or specific version:${colors.reset} `);
    }

    // Handle version bump keywords
    if (newVersion === 'major' || newVersion === 'minor' || newVersion === 'patch') {
      const [major, minor, patch] = currentVersion.split('.').map(Number);

      if (newVersion === 'major') {
        newVersion = `${major + 1}.0.0`;
      } else if (newVersion === 'minor') {
        newVersion = `${major}.${minor + 1}.0`;
      } else if (newVersion === 'patch') {
        newVersion = `${major}.${minor}.${patch + 1}`;
      }
    }

    // Validate version format
    if (!isValidVersion(newVersion)) {
      console.log(`${colors.red}Error: Invalid version format. Expected format: x.y.z${colors.reset}`);
      process.exit(1);
    }

    // Confirm the release
    console.log(`${colors.bright}You are about to release version ${colors.green}${newVersion}${colors.reset}`);
    const confirm = await prompt(`${colors.bright}Do you want to proceed? (y/N)${colors.reset} `);

    if (confirm.toLowerCase() !== 'y') {
      console.log(`${colors.yellow}Release cancelled.${colors.reset}`);
      process.exit(0);
    }

    // Run tests
    console.log(`${colors.blue}Running tests...${colors.reset}`);
    try {
      if (!isDryRun) {
        exec('npm test');
      } else {
        try {
          exec('npm test', { silent: true });
          console.log(`${colors.yellow}DRY RUN: Tests passed${colors.reset}`);
        } catch (error) {
          console.log(`${colors.yellow}DRY RUN: Tests would fail in a real release${colors.reset}`);
          const skipTests = await prompt(`${colors.bright}Tests are failing. Skip tests for dry run? (y/N)${colors.reset} `);
          if (skipTests.toLowerCase() !== 'y') {
            console.log(`${colors.yellow}Dry run cancelled.${colors.reset}`);
            process.exit(0);
          }
        }
      }
    } catch (error) {
      console.log(`${colors.red}Error: Tests failed. Fix the tests before releasing.${colors.reset}`);

      // In case of dry run, ask if we want to continue despite failing tests
      if (isDryRun) {
        const skipTests = await prompt(`${colors.bright}Skip tests for this dry run? (y/N)${colors.reset} `);
        if (skipTests.toLowerCase() !== 'y') {
          process.exit(1);
        }
      } else {
        process.exit(1);
      }
    }

    // Build the project
    console.log(`${colors.blue}Building the project...${colors.reset}`);
    try {
      if (!isDryRun) {
        exec('npm run build');
      } else {
        try {
          exec('npm run build', { silent: true });
          console.log(`${colors.yellow}DRY RUN: Build successful${colors.reset}`);
        } catch (error) {
          console.log(`${colors.yellow}DRY RUN: Build would fail in a real release${colors.reset}`);
          const skipBuild = await prompt(`${colors.bright}Build is failing. Skip build for dry run? (y/N)${colors.reset} `);
          if (skipBuild.toLowerCase() !== 'y') {
            console.log(`${colors.yellow}Dry run cancelled.${colors.reset}`);
            process.exit(0);
          }
        }
      }
    } catch (error) {
      console.log(`${colors.red}Error: Build failed. Fix the build before releasing.${colors.reset}`);
      process.exit(1);
    }

    // Build native modules for all platforms
    console.log(`${colors.blue}Building native modules...${colors.reset}`);
    try {
      if (!isDryRun) {
        exec('npm run build:native:all');
      } else {
        try {
          // Just try to build for the current platform in dry run mode
          exec('npm run build:native', { silent: true });
          console.log(`${colors.yellow}DRY RUN: Native module build successful${colors.reset}`);
        } catch (error) {
          console.log(`${colors.yellow}DRY RUN: Native module build would fail in a real release${colors.reset}`);
          const skipNativeBuild = await prompt(`${colors.bright}Native module build is failing. Skip for dry run? (y/N)${colors.reset} `);
          if (skipNativeBuild.toLowerCase() !== 'y') {
            console.log(`${colors.yellow}Dry run cancelled.${colors.reset}`);
            process.exit(0);
          }
        }
      }
    } catch (error) {
      console.log(`${colors.yellow}Warning: Failed to build native modules for all platforms.${colors.reset}`);
      const proceed = await prompt(`${colors.bright}Do you want to proceed anyway? (y/N)${colors.reset} `);
      if (proceed.toLowerCase() !== 'y') {
        process.exit(0);
      }
    }

    // Update version in package.json
    if (!isDryRun) {
      updateVersion(newVersion);
    } else {
      console.log(`${colors.yellow}DRY RUN: Would update version to ${newVersion}${colors.reset}`);
    }

    // Update changelog
    if (!isDryRun) {
      await updateChangelog(newVersion);
    } else {
      console.log(`${colors.yellow}DRY RUN: Would update docs/CHANGELOG.md for version ${newVersion}${colors.reset}`);
    }

    // Commit changes
    if (!isDryRun) {
      commitChanges(newVersion);
    } else {
      console.log(`${colors.yellow}DRY RUN: Would commit changes with message "chore: release v${newVersion}"${colors.reset}`);
    }

    // Create and push git tag
    if (!isDryRun) {
      createAndPushTag(newVersion);
    } else {
      console.log(`${colors.yellow}DRY RUN: Would create and push tag v${newVersion}${colors.reset}`);
    }

    // Create GitHub release and upload assets
    await createGitHubRelease(newVersion);

    // Publish to npm
    await publishToNpm();

    if (isDryRun) {
      console.log(`\n${colors.green}${colors.bright}Dry run completed successfully for v${newVersion}!${colors.reset}`);
    } else {
      console.log(`\n${colors.green}${colors.bright}Successfully released NexureJS v${newVersion}!${colors.reset}`);
    }

  } catch (error) {
    console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the main function
main();
