#!/usr/bin/env node

/**
 * Release Notes Generator
 *
 * This script generates detailed release notes by:
 * 1. Extracting the relevant section from CHANGELOG.md
 * 2. Adding commit details since the last release
 * 3. Including contributors and metadata
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

// Parse command line arguments
const args = process.argv.slice(2);
let version = '';

args.forEach(arg => {
  if (arg.startsWith('--version=')) {
    version = arg.split('=')[1];
  }
});

if (!version) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
    version = packageJson.version;
    console.log(`${Colors.BLUE}Using version from package.json: ${version}${Colors.RESET}`);
  } catch (error) {
    console.error(`${Colors.RED}Failed to read version from package.json: ${error.message}${Colors.RESET}`);
    process.exit(1);
  }
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
    return { success: true, output: output.trim() };
  } catch (error) {
    return {
      success: false,
      output: error.stdout?.trim() || '',
      error: error.stderr?.trim() || error.message
    };
  }
}

/**
 * Extract version section from CHANGELOG.md
 */
function extractChangelogSection() {
  try {
    const changelogPath = path.join(rootDir, 'docs', 'CHANGELOG.md');

    if (!fs.existsSync(changelogPath)) {
      console.log(`${Colors.YELLOW}CHANGELOG.md not found in docs directory, checking root...${Colors.RESET}`);
      const rootChangelogPath = path.join(rootDir, 'CHANGELOG.md');

      if (!fs.existsSync(rootChangelogPath)) {
        console.error(`${Colors.RED}CHANGELOG.md not found${Colors.RESET}`);
        return null;
      }

      return extractVersionFromChangelog(rootChangelogPath);
    }

    return extractVersionFromChangelog(changelogPath);
  } catch (error) {
    console.error(`${Colors.RED}Error reading CHANGELOG.md:${Colors.RESET}`, error.message);
    return null;
  }
}

/**
 * Extract specific version section from a changelog file
 */
function extractVersionFromChangelog(changelogPath) {
  const changelog = fs.readFileSync(changelogPath, 'utf-8');

  // Find the section for this version
  const versionRegex = new RegExp(`## \\[${version}\\].*?(?=## \\[|$)`, 's');
  const match = changelog.match(versionRegex);

  if (!match) {
    console.warn(`${Colors.YELLOW}No section found for version ${version} in CHANGELOG.md${Colors.RESET}`);
    return null;
  }

  return match[0].trim();
}

/**
 * Get commits since the previous tag
 */
function getCommitsSinceLastTag() {
  // Find the previous tag
  const tagsResult = runCommand('git tag --sort=-v:refname', { silent: true });

  if (!tagsResult.success || !tagsResult.output) {
    console.warn(`${Colors.YELLOW}No previous tags found${Colors.RESET}`);
    return [];
  }

  const tags = tagsResult.output.split('\n').filter(Boolean);
  const currentTagIndex = tags.findIndex(tag => tag === `v${version}`);
  const previousTag = currentTagIndex >= 0 && currentTagIndex < tags.length - 1
    ? tags[currentTagIndex + 1]
    : tags[0]; // Use the current tag as fallback

  // Get commits between tags
  const range = currentTagIndex >= 0 ? `${previousTag}..v${version}` : previousTag;
  const commitsResult = runCommand(
    `git log --pretty=format:"%h|%an|%s" ${range}`,
    { silent: true }
  );

  if (!commitsResult.success || !commitsResult.output) {
    console.warn(`${Colors.YELLOW}No commits found between tags${Colors.RESET}`);
    return [];
  }

  // Parse commits into structured data
  return commitsResult.output.split('\n')
    .filter(Boolean)
    .map(line => {
      const [hash, author, subject] = line.split('|');
      return { hash, author, subject };
    });
}

/**
 * Categorize commits by type (feat, fix, etc.)
 */
function categorizeCommits(commits) {
  const categories = {
    feat: [],
    fix: [],
    docs: [],
    chore: [],
    refactor: [],
    test: [],
    perf: [],
    other: []
  };

  const commitTypeRegex = /^(feat|fix|docs|chore|refactor|test|perf)(\(.+\))?:\s+(.+)$/;

  commits.forEach(commit => {
    const match = commit.subject.match(commitTypeRegex);

    if (match) {
      const type = match[1];
      const scope = match[2] ? match[2].replace(/[()]/g, '') : '';
      const message = match[3];

      if (categories[type]) {
        categories[type].push({
          ...commit,
          scope,
          message
        });
      } else {
        categories.other.push(commit);
      }
    } else {
      categories.other.push(commit);
    }
  });

  return categories;
}

/**
 * Get contributors since the last tag
 */
function getContributors() {
  // Find the previous tag
  const tagsResult = runCommand('git tag --sort=-v:refname', { silent: true });

  if (!tagsResult.success || !tagsResult.output) {
    return [];
  }

  const tags = tagsResult.output.split('\n').filter(Boolean);
  const currentTagIndex = tags.findIndex(tag => tag === `v${version}`);
  const previousTag = currentTagIndex >= 0 && currentTagIndex < tags.length - 1
    ? tags[currentTagIndex + 1]
    : tags[0];

  // Get contributors between tags
  const range = currentTagIndex >= 0 ? `${previousTag}..v${version}` : previousTag;
  const contributorsResult = runCommand(
    `git log --pretty=format:"%an|%ae" ${range} | sort | uniq`,
    { silent: true }
  );

  if (!contributorsResult.success || !contributorsResult.output) {
    return [];
  }

  // Parse contributors into structured data
  return contributorsResult.output.split('\n')
    .filter(Boolean)
    .map(line => {
      const [name, email] = line.split('|');
      return { name, email };
    });
}

/**
 * Format categorized commits into markdown
 */
function formatCommitsAsMarkdown(categorizedCommits) {
  const categoryTitles = {
    feat: 'New Features',
    fix: 'Bug Fixes',
    docs: 'Documentation Changes',
    chore: 'Chores',
    refactor: 'Code Refactoring',
    test: 'Tests',
    perf: 'Performance Improvements',
    other: 'Other Changes'
  };

  let markdown = '';

  Object.entries(categorizedCommits).forEach(([category, commits]) => {
    if (commits.length === 0) return;

    markdown += `\n### ${categoryTitles[category]}\n\n`;

    commits.forEach(commit => {
      const message = commit.message || commit.subject;
      markdown += `- ${message} ([${commit.hash.substring(0, 7)}](${getCommitUrl(commit.hash)}))\n`;
    });

    markdown += '\n';
  });

  return markdown;
}

/**
 * Format contributors into markdown
 */
function formatContributorsAsMarkdown(contributors) {
  if (contributors.length === 0) return '';

  let markdown = '\n### Contributors\n\n';

  contributors.forEach(contributor => {
    markdown += `- ${contributor.name}\n`;
  });

  return markdown;
}

/**
 * Get the commit URL based on the repository info
 */
function getCommitUrl(hash) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
    const repoUrl = packageJson.repository?.url || '';
    const repoMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);

    if (repoMatch) {
      const [, owner, repo] = repoMatch;
      return `https://github.com/${owner}/${repo}/commit/${hash}`;
    }
  } catch (error) {
    // Ignore errors
  }

  return `${hash}`;
}

/**
 * Generate full release notes
 */
function generateReleaseNotes() {
  // Extract changelog section
  const changelogSection = extractChangelogSection();

  // Get commits since the last tag
  const commits = getCommitsSinceLastTag();
  const categorizedCommits = categorizeCommits(commits);

  // Get contributors
  const contributors = getContributors();

  // Generate markdown
  let markdown = `# Release v${version}\n\n`;

  // Include changelog section if available
  if (changelogSection) {
    markdown += `${changelogSection}\n\n`;
  }

  // Include commit details
  markdown += `## What's Changed\n`;
  markdown += formatCommitsAsMarkdown(categorizedCommits);

  // Include contributors
  markdown += formatContributorsAsMarkdown(contributors);

  // Include package details
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));

    markdown += '\n## Package Information\n\n';
    markdown += `- **Package**: ${packageJson.name}\n`;
    markdown += `- **Version**: ${version}\n`;

    if (packageJson.engines) {
      markdown += `- **Node.js Version**: ${packageJson.engines.node}\n`;
    }

    const dependencies = Object.keys(packageJson.dependencies || {}).length;
    const devDependencies = Object.keys(packageJson.devDependencies || {}).length;

    markdown += `- **Dependencies**: ${dependencies}\n`;
    markdown += `- **Dev Dependencies**: ${devDependencies}\n`;
  } catch (error) {
    // Ignore errors
  }

  // Include installation instructions
  markdown += '\n## Installation\n\n';
  markdown += '```bash\n';
  markdown += `npm install nexurejs@${version}\n`;
  markdown += '```\n\n';

  return markdown;
}

/**
 * Main function
 */
function main() {
  try {
    console.log(`${Colors.BLUE}Generating release notes for version ${version}...${Colors.RESET}`);

    // Generate release notes
    const releaseNotes = generateReleaseNotes();

    // Write to file
    fs.writeFileSync(path.join(rootDir, 'release-notes.md'), releaseNotes);

    console.log(`${Colors.GREEN}Release notes generated successfully: release-notes.md${Colors.RESET}`);
  } catch (error) {
    console.error(`${Colors.RED}Error generating release notes:${Colors.RESET}`, error);
    process.exit(1);
  }
}

// Run the script
main();
