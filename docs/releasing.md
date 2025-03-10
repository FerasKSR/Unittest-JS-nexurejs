# Release Process for NexureJS

This document outlines the process for creating and publishing new releases of NexureJS.

## Prerequisites

Before starting the release process, ensure you have:

1. Push access to the NexureJS GitHub repository
2. npm publishing rights for the NexureJS package
3. Node.js and npm installed locally
4. All tests passing on the main branch across all platforms (Ubuntu, Windows, macOS)
5. A GitHub personal access token with `repo` scope for creating releases

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

2. Run tests to ensure everything is working across all platforms:
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

### 2. Run the Release Script

The release process is now fully automated with a unified release script:

```bash
npm run release [major|minor|patch|<version>]
```

For example:
```bash
npm run release:patch  # For patch releases
npm run release:minor  # For minor releases
npm run release:major  # For major releases
npm run release 1.2.3  # For specific versions
```

The release script will:

1. Update the version in package.json
2. Update the CHANGELOG.md file (you'll be prompted to review and edit)
3. Commit the changes
4. Create and push a git tag
5. Create a GitHub release with release notes from the CHANGELOG.md
6. Upload prebuilt binaries to the GitHub release with retry logic
7. Publish the package to npm

You can also run the script with the `--dry-run` flag to see what would happen without making any changes:

```bash
npm run release:patch --dry-run
```

### 3. Manual Release Process (if needed)

If you need to perform the release steps manually:

#### 2.1 Update Version and Changelog

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

#### 2.2 Tag and Release

1. Create a git tag for the new version:
   ```bash
   git tag -a v<new-version> -m "Release v<new-version>"
   ```

2. Push the tag to GitHub:
   ```bash
   git push origin v<new-version>
   ```

3. Create a GitHub release and upload prebuilt binaries:
   ```bash
   GITHUB_TOKEN=your_token_here node scripts/release.js
   ```

   This unified script will:
   - Create a GitHub release for the current version
   - Extract release notes from CHANGELOG.md
   - Upload all prebuilt binaries from the `prebuilds` directory with retry logic
   - Publish the package to npm (if you choose to)

### 4. Announce the Release

1. Announce the new release on:
   - GitHub Discussions
   - Twitter/X
   - Discord community (if applicable)
   - Dev.to or Medium blog post (for major releases)

2. Highlight key features, improvements, and breaking changes.

## CI/CD Pipeline

NexureJS uses GitHub Actions for continuous integration and deployment:

1. **Test Workflow**: Runs tests on multiple platforms (Ubuntu, Windows, macOS) and Node.js versions
2. **Release Workflow**: Automates the release process
3. **npm Publish Workflow**: Publishes the package to npm

You can trigger the release workflow manually from the GitHub Actions tab.

## Handling Hotfixes

For urgent fixes that need to be released outside the normal release cycle:

1. Create a hotfix branch from the latest release tag:
   ```bash
   git checkout -b hotfix/v<current-version>.<patch> v<current-version>
   ```

2. Make the necessary fixes and commit them.

3. Update the version in `package.json` and update the CHANGELOG.md.

4. Use the release script to complete the process:
   ```bash
   npm run release <current-version>.<patch>
   ```

## Release Checklist

- [ ] All tests passing on all platforms (Ubuntu, Windows, macOS)
- [ ] Code built successfully
- [ ] Native modules built for all platforms
- [ ] Version updated in package.json
- [ ] CHANGELOG.md updated
- [ ] Git tag created and pushed
- [ ] GitHub release created with release notes
- [ ] Prebuilt binaries uploaded to GitHub release
- [ ] Package published to npm
- [ ] Release announced to the community
