#!/usr/bin/env node

/**
 * NexureJS GitHub Release Creator
 *
 * This script creates a GitHub release for the current version and uploads prebuilt binaries.
 * It uses the GitHub REST API to create the release and upload assets.
 *
 * Usage:
 *   node scripts/create-github-release.js
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

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

// Helper function for logging with colors
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Helper function to read package.json
function getPackageInfo() {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  return packageJson;
}

// Helper function to read CHANGELOG.md
function getChangelogForVersion(version) {
  const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
  const changelog = fs.readFileSync(changelogPath, 'utf-8');

  // Extract release notes for the specified version
  const versionRegex = new RegExp(`## \\[${version}\\].*?\\n(.*?)\\n## \\[`, 's');
  const match = changelog.match(versionRegex);

  if (match && match[1]) {
    return match[1].trim();
  }

  return '';
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

// Create a GitHub release
async function createGitHubRelease(version, releaseNotes) {
  log(`Creating GitHub release for v${version}...`, colors.blue);

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
    log(`GitHub release created successfully!`, colors.green);
    return release;
  } catch (error) {
    if (error.message.includes('already exists')) {
      log(`Release for v${version} already exists.`, colors.yellow);

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

// Upload assets to a GitHub release
async function uploadReleaseAssets(release, assetPaths) {
  log(`Uploading assets to GitHub release...`, colors.blue);

  // Get GitHub token from environment variable
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is not set');
  }

  const uploadUrl = release.upload_url.replace(/{.*}/, '');
  const successfulUploads = [];
  const failedUploads = [];

  for (const assetPath of assetPaths) {
    const assetName = path.basename(assetPath);
    log(`Uploading ${assetName}...`, colors.dim);

    // Try up to 3 times to upload each asset
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
          timeout: 30000 // 30 second timeout
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

          // Write data in smaller chunks to avoid EPIPE errors
          const chunkSize = 1024 * 1024; // 1MB chunks
          for (let i = 0; i < fileData.length; i += chunkSize) {
            const end = Math.min(i + chunkSize, fileData.length);
            req.write(fileData.slice(i, end));
          }

          req.end();
        });

        log(`Uploaded ${assetName} successfully!`, colors.green);
        success = true;
        successfulUploads.push(assetName);
        break; // Exit retry loop on success
      } catch (error) {
        if (attempt < 3) {
          log(`Attempt ${attempt} failed for ${assetName}: ${error.message}. Retrying...`, colors.yellow);
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        } else {
          log(`Failed to upload ${assetName} after ${attempt} attempts: ${error.message}`, colors.red);
          failedUploads.push(assetName);
        }
      }
    }
  }

  // Summary of uploads
  if (successfulUploads.length > 0) {
    log(`\nSuccessfully uploaded ${successfulUploads.length} assets:`, colors.green);
    successfulUploads.forEach(asset => log(`- ${asset}`, colors.green));
  }

  if (failedUploads.length > 0) {
    log(`\nFailed to upload ${failedUploads.length} assets:`, colors.red);
    failedUploads.forEach(asset => log(`- ${asset}`, colors.red));

    // Provide instructions for manual upload
    log(`\nYou can manually upload the failed assets at:`, colors.yellow);
    log(`${release.html_url}/assets/upload`, colors.yellow);
  }

  return {
    successCount: successfulUploads.length,
    failureCount: failedUploads.length,
    release
  };
}

// Main function
async function main() {
  try {
    log(`${colors.bright}${colors.magenta}NexureJS GitHub Release Creator${colors.reset}\n`);

    // Get version from package.json
    const packageInfo = getPackageInfo();
    const version = packageInfo.version;

    log(`Creating release for version ${colors.bright}${version}${colors.reset}`);

    // Get release notes from CHANGELOG.md
    const releaseNotes = getChangelogForVersion(version);
    if (!releaseNotes) {
      log(`Could not find release notes for version ${version} in CHANGELOG.md`, colors.yellow);
      log(`Please make sure the CHANGELOG.md file is properly formatted.`, colors.yellow);
      process.exit(1);
    }

    // Check for GitHub token
    if (!process.env.GITHUB_TOKEN) {
      log(`${colors.red}Error: GITHUB_TOKEN environment variable is not set.${colors.reset}`);
      log(`Please set the GITHUB_TOKEN environment variable with a valid GitHub personal access token.`, colors.yellow);
      log(`You can create a token at https://github.com/settings/tokens`, colors.yellow);
      process.exit(1);
    }

    // Create GitHub release
    const release = await createGitHubRelease(version, releaseNotes);

    // Find prebuilt binaries
    const prebuildsDir = path.join(__dirname, '..', 'prebuilds');
    if (!fs.existsSync(prebuildsDir)) {
      log(`Prebuilds directory not found at ${prebuildsDir}`, colors.yellow);
      log(`Release created successfully, but no prebuilt binaries were uploaded.`, colors.yellow);
      log(`Release URL: ${release.html_url}`, colors.green);
      process.exit(0);
    }

    const assetPaths = fs.readdirSync(prebuildsDir)
      .filter(file => file.endsWith('.tar.gz'))
      .map(file => path.join(prebuildsDir, file));

    if (assetPaths.length === 0) {
      log(`No prebuilt binaries found in ${prebuildsDir}`, colors.yellow);
      log(`Release created successfully, but no prebuilt binaries were uploaded.`, colors.yellow);
      log(`Release URL: ${release.html_url}`, colors.green);
      process.exit(0);
    }

    // Upload assets to GitHub release
    const uploadResult = await uploadReleaseAssets(release, assetPaths);

    log(`\n${colors.green}${colors.bright}GitHub release created successfully!${colors.reset}`);
    log(`${colors.green}${colors.bright}${uploadResult.successCount} of ${assetPaths.length} assets uploaded.${colors.reset}`);
    log(`${colors.green}${colors.bright}Release URL: ${release.html_url}${colors.reset}`);

    if (uploadResult.failureCount > 0) {
      process.exit(1); // Exit with error if any uploads failed
    }

  } catch (error) {
    log(`${colors.red}Error: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Run the main function
main();
