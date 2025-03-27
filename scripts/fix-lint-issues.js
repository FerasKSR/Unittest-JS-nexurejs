#!/usr/bin/env node

/**
 * Fix common linting issues
 *
 * This script helps fix common TypeScript linting issues by:
 * 1. Adding underscore prefixes to unused variables, parameters and error catches
 * 2. Updating @ts-ignore to @ts-expect-error with proper descriptions
 * 3. Other automated fixes
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SRC_DIR = path.join(__dirname, '..', 'src');
const EXTENSIONS = ['.ts', '.tsx'];
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

console.log('Starting lint fix script...');
console.log(`DRY_RUN: ${DRY_RUN}, VERBOSE: ${VERBOSE}`);

// Cache of file contents to avoid multiple reads
const fileCache = new Map();

/**
 * Get file content from cache or read from disk
 */
function getFileContent(filePath) {
  if (!fileCache.has(filePath)) {
    if (fs.existsSync(filePath)) {
      fileCache.set(filePath, fs.readFileSync(filePath, 'utf8'));
    } else {
      return null;
    }
  }
  return fileCache.get(filePath);
}

/**
 * Write file content if changed
 */
function writeFileIfChanged(filePath, newContent) {
  const originalContent = getFileContent(filePath);
  if (originalContent !== newContent) {
    if (!DRY_RUN) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`Updated ${filePath}`);
    } else {
      console.log(`Would update ${filePath} (dry run)`);
    }
    // Update cache
    fileCache.set(filePath, newContent);
    return true;
  }
  return false;
}

// Get list of linting issues
function getLintingIssues() {
  try {
    console.log('Finding linting issues...');
    console.log('Running ESLint to collect issues...');
    const output = execSync('npm run lint --silent', { encoding: 'utf8' });
    console.log('ESLint completed successfully.');
    return parseEslintOutput(output);
  } catch (error) {
    console.log('ESLint found issues (non-zero exit code)');
    // ESLint exits with non-zero when issues are found
    if (error.stdout) {
      return parseEslintOutput(error.stdout);
    } else {
      console.error('Error running ESLint:', error);
      return [];
    }
  }
}

// Parse ESLint output to extract issues
function parseEslintOutput(output) {
  console.log('Parsing ESLint output...');
  const lines = output.split('\n');
  const issues = [];
  let currentFile = null;

  // Single-pass regex parsing
  const fileRegex = /^\/.*$/;
  const issueRegex = /^\s+(\d+):(\d+)\s+warning\s+(.+?)\s+(@typescript-eslint\/[a-z-]+)/;

  for (const line of lines) {
    if (fileRegex.test(line)) {
      currentFile = line.trim();
    } else if (currentFile) {
      const match = line.match(issueRegex);
      if (match) {
        issues.push({
          file: currentFile,
          line: parseInt(match[1], 10),
          column: parseInt(match[2], 10),
          message: match[3].trim(),
          rule: match[4]
        });
      }
    }
  }

  console.log(`Found ${issues.length} issues to process.`);
  return issues;
}

// Fix unused variables by adding underscore prefix
function fixUnusedVariables(issues) {
  // Group issues by file for faster processing
  const fileIssues = new Map();

  issues.filter(issue => issue.rule === '@typescript-eslint/no-unused-vars')
    .forEach(issue => {
      if (!fileIssues.has(issue.file)) {
        fileIssues.set(issue.file, []);
      }
      fileIssues.get(issue.file).push(issue);
    });

  // Process each file once
  for (const [file, fileIssues] of fileIssues.entries()) {
    const content = getFileContent(file);
    if (!content) continue;

    const lines = content.split('\n');
    let changed = false;

    // Group issues by line
    const issuesByLine = new Map();
    fileIssues.forEach(issue => {
      if (!issuesByLine.has(issue.line)) {
        issuesByLine.set(issue.line, []);
      }
      issuesByLine.get(issue.line).push(issue);
    });

    // Fix each line
    for (const [lineNum, lineIssues] of issuesByLine.entries()) {
      const lineIndex = parseInt(lineNum, 10) - 1;
      const line = lines[lineIndex];

      // Extract variable name from issue message
      for (const issue of lineIssues) {
        // Match patterns like: 'variableName' is defined but never used
        const varMatch = issue.message.match(/'([^']+)' is (defined|assigned a value) but never used/);
        if (varMatch) {
          const varName = varMatch[1];
          if (!varName.startsWith('_')) {
            // Replace the variable name with prefixed version
            const prefixedName = `_${varName}`;
            // Use word boundary to avoid partial replacements
            const regex = new RegExp(`\\b${varName}\\b`, 'g');
            lines[lineIndex] = lines[lineIndex].replace(regex, prefixedName);
            changed = true;

            if (VERBOSE) {
              console.log(`[FIXED] ${file}:${lineNum} - Renamed ${varName} to ${prefixedName}`);
            }
          }
        }
      }
    }

    if (changed) {
      writeFileIfChanged(file, lines.join('\n'));
    }
  }
}

// Fix @ts-ignore comments to @ts-expect-error
function fixTsIgnoreComments(issues) {
  // Group issues by file for faster processing
  const fileIssues = new Map();

  issues.filter(issue =>
    issue.rule === '@typescript-eslint/ban-ts-comment' &&
    issue.message.includes('@ts-ignore')
  ).forEach(issue => {
    if (!fileIssues.has(issue.file)) {
      fileIssues.set(issue.file, []);
    }
    fileIssues.get(issue.file).push(issue);
  });

  // Process each file once
  for (const [file, fileIssues] of fileIssues.entries()) {
    const content = getFileContent(file);
    if (!content) continue;

    const lines = content.split('\n');
    let changed = false;

    for (const issue of fileIssues) {
      const lineIndex = issue.line - 1;
      const line = lines[lineIndex];

      if (line.includes('@ts-ignore')) {
        // Replace @ts-ignore with @ts-expect-error
        let newLine = line.replace('@ts-ignore', '@ts-expect-error');

        // Add description if none exists
        if (!newLine.includes('-')) {
          newLine = newLine + ' - Explicit type checking suppression';
        }

        lines[lineIndex] = newLine;
        changed = true;

        if (VERBOSE) {
          console.log(`[FIXED] ${file}:${issue.line} - Updated @ts-ignore comment`);
        }
      }
    }

    if (changed) {
      writeFileIfChanged(file, lines.join('\n'));
    }
  }
}

// Main execution
console.log('Finding linting issues...');
const issues = getLintingIssues();
console.log(`Found ${issues.length} issues. Starting fixes...`);

if (VERBOSE) {
  console.log('Issues found:');
  issues.forEach(issue => {
    console.log(`${issue.file}:${issue.line}:${issue.column} - ${issue.message} (${issue.rule})`);
  });
}

if (issues.length === 0) {
  console.log('No issues to fix. Exiting.');
  process.exit(0);
}

fixUnusedVariables(issues);
fixTsIgnoreComments(issues);

if (DRY_RUN) {
  console.log('Dry run completed. No files were changed.');
} else {
  console.log('Fixes applied. Run "npm run lint" to check remaining issues.');
}
