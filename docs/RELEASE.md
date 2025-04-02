# NexureJS Release Guide

This document outlines the release process for NexureJS, including both manual and automated approaches.

## Release Methods

NexureJS provides two ways to create releases:

1. **Automated GitHub Workflow** - Trigger a release via GitHub Actions
2. **Local Script** - Run the release script on your local machine

## Automated Release via GitHub Actions

The simplest way to create a new release is using the GitHub Actions workflow:

1. Go to the GitHub repository
2. Navigate to "Actions" > "Release" workflow
3. Click "Run workflow"
4. Enter the information:
   - **Version bump type**: Choose `patch`, `minor`, or `major`
   - **Publish to npm**: Check to automatically publish to npm

The workflow will:
- Build and test the package
- Bump version in package.json
- Generate a changelog
- Create a git tag and GitHub release
- Optionally publish to npm

## Manual Release Process

For more control over the release process, you can use the local script:

```bash
# Make sure your working directory is clean
git status

# Run the release script
npm run release
```

The script will:
1. Validate that builds and tests pass
2. Ask for the version bump type (major, minor, patch)
3. Generate a changelog from commits since the last tag
4. Update the version in package.json
5. Create a git commit and tag
6. Optionally publish to npm
7. Optionally push changes to the remote repository

## Version Numbering

NexureJS follows [Semantic Versioning](https://semver.org/):

- **Major** (x.0.0): Breaking changes that require updates to consuming code
- **Minor** (0.x.0): New features in a backward-compatible manner
- **Patch** (0.0.x): Backward-compatible bug fixes and minor improvements

## Pre-Release Checklist

Before creating a release, ensure:

1. All tests pass: `npm run test:all`
2. The build is working: `npm run build:all`
3. Documentation is up-to-date
4. The changelog is ready for release
5. Your local repository is in sync with the remote

## Post-Release Checklist

After creating a release:

1. Verify the npm package is published correctly
2. Check the GitHub release page for accuracy
3. Test the published package in a new project
4. Announce the release in appropriate channels

## Troubleshooting

If you encounter issues during the release process:

- **Failed tests**: Fix the issues and try again
- **Git errors**: Ensure your working directory is clean and you have proper permissions
- **NPM publish errors**: Check your npm credentials and package.json configuration
- **Manual fixes**: You can manually perform any of the release steps if automation fails

## Required Permissions

To perform releases:

- **GitHub Actions Workflow**: Requires write access to the repository
- **Manual Release**: Requires both repository write access and npm publish permissions

For npm publishing, you need to be added as a collaborator to the npm package.
