# Release Process for NexureJS

This document outlines the process for creating and publishing new releases of NexureJS.

## Prerequisites

Before starting the release process, ensure you have:

1. Push access to the NexureJS GitHub repository
2. npm publishing rights for the NexureJS package
3. Node.js and npm installed locally
4. All tests passing on the main branch

## Version Numbering

NexureJS follows [Semantic Versioning](https://semver.org/) (SemVer):

- **Major version (X.0.0)**: Incompatible API changes
- **Minor version (0.X.0)**: New functionality in a backward-compatible manner
- **Patch version (0.0.X)**: Backward-compatible bug fixes

## Release Process

### 1. Prepare the Release

1. Ensure you're on the main branch and it's up to date:
   ```bash
   git checkout main
   git pull origin main
   ```

2. Run tests to ensure everything is working:
   ```bash
   npm test
   ```

3. Build the project to ensure it compiles correctly:
   ```bash
   npm run build
   ```

4. Build native modules for all platforms:
   ```bash
   npm run build:native:all
   ```

### 2. Update Version and Changelog

1. Determine the new version number based on the changes since the last release.

2. Update the version in `package.json`:
   ```bash
   npm version <new-version> --no-git-tag-version
   ```

3. Update the CHANGELOG.md file with details of the changes in this release:
   - New features
   - Bug fixes
   - Performance improvements
   - Breaking changes (if any)

4. Commit the version and changelog changes:
   ```bash
   git add package.json CHANGELOG.md
   git commit -m "chore: prepare release v<new-version>"
   ```

### 3. Create a Release Branch

1. Create a release branch:
   ```bash
   git checkout -b release/v<new-version>
   ```

2. Push the release branch to GitHub:
   ```bash
   git push origin release/v<new-version>
   ```

3. Create a pull request from the release branch to main for review.

4. After review and approval, merge the pull request into main.

### 4. Tag and Release

1. Checkout the main branch and pull the latest changes:
   ```bash
   git checkout main
   git pull origin main
   ```

2. Create a git tag for the new version:
   ```bash
   git tag -a v<new-version> -m "Release v<new-version>"
   ```

3. Push the tag to GitHub:
   ```bash
   git push origin v<new-version>
   ```

4. Create a GitHub release:
   - Go to the [GitHub releases page](https://github.com/nexurejs/nexurejs/releases)
   - Click "Draft a new release"
   - Select the tag you just pushed
   - Set the title to "NexureJS v<new-version>"
   - Add release notes from the CHANGELOG.md
   - If this is a pre-release, check the "This is a pre-release" box
   - Click "Publish release"

5. Upload prebuilt binaries to the GitHub release:
   - Attach all files from the `prebuilds` directory to the GitHub release

### 5. Publish to npm

1. Ensure you're logged in to npm:
   ```bash
   npm login
   ```

2. Publish the package:
   ```bash
   npm publish
   ```

3. For pre-releases, use the appropriate tag:
   ```bash
   npm publish --tag beta  # for beta releases
   npm publish --tag next  # for next releases
   ```

### 6. Announce the Release

1. Announce the new release on:
   - GitHub Discussions
   - Twitter/X
   - Discord community (if applicable)
   - Dev.to or Medium blog post (for major releases)

2. Highlight key features, improvements, and breaking changes.

## Handling Hotfixes

For urgent fixes that need to be released outside the normal release cycle:

1. Create a hotfix branch from the latest release tag:
   ```bash
   git checkout -b hotfix/v<current-version>.<patch> v<current-version>
   ```

2. Make the necessary fixes and commit them.

3. Update the version in `package.json` and update the CHANGELOG.md.

4. Follow steps 4-6 from the regular release process.

## Release Checklist

- [ ] All tests passing
- [ ] Code built successfully
- [ ] Native modules built for all platforms
- [ ] Version updated in package.json
- [ ] CHANGELOG.md updated
- [ ] Release branch created and merged
- [ ] Git tag created and pushed
- [ ] GitHub release created with release notes
- [ ] Prebuilt binaries uploaded to GitHub release
- [ ] Package published to npm
- [ ] Release announced to the community
