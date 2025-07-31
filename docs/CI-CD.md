# CI/CD Pipeline Documentation

This document describes the CI/CD pipeline setup for the OSC MCP Server project.

## Overview

The project uses GitHub Actions for continuous integration and deployment, with automated testing, security scanning, and npm publishing.

## Workflows

### 1. Main CI/CD Pipeline (`ci.yml`)

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` branch

**Jobs:**

#### Test Job
- Runs on Node.js versions 18, 20, and 22
- Executes linting, formatting checks, TypeScript compilation, and tests with coverage
- Uploads coverage reports to Codecov (Node.js 20 only)

#### Security Job
- Runs security audit with `npm audit`
- Performs vulnerability scanning with `audit-ci`
- Only runs after successful tests

### 2. Security & Dependency Updates (`security.yml`)

**Triggers:**
- Daily schedule (2 AM UTC)
- Manual dispatch

**Features:**
- Daily security audits
- Dependency vulnerability scanning
- Automatic issue creation on security findings
- Pull request dependency review

### 3. Release Management (`release.yml`)

**Triggers:**
- Git tags matching `v*` pattern

**Features:**
- Tag format validation
- Package version verification
- Automatic changelog generation
- GitHub release creation
- Automated npm publishing with provenance
- Test execution before publishing

### 4. Manual Release (`manual-release.yml`)

**Triggers:**
- Manual workflow dispatch

**Features:**
- Interactive version selection
- Automated version bumping
- Git tagging and pushing
- Direct npm publishing

## Required Secrets

Configure these secrets in your GitHub repository:

- `NPM_TOKEN`: npm authentication token for publishing
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions

## Dependabot Configuration

Automated dependency updates are configured via `.github/dependabot.yml`:

- **npm dependencies**: Weekly updates on Mondays
- **GitHub Actions**: Weekly updates on Mondays
- **Grouping**: Separate groups for development and production dependencies

## Package Configuration

### Scripts

- `test:coverage`: Run tests with coverage reporting
- `prepack`: Build before packaging
- `version`: Build and stage dist files during version bump
- `postversion`: Push changes and tags after version bump

### Publishing

- **Access**: Public package
- **Registry**: npm registry
- **Provenance**: Enabled for supply chain security
- **Files**: Only `dist/`, `README.md`, and `LICENSE` are published

## Release Process

### Automated Release (Recommended)

1. Create and push a git tag:
   ```powershell
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. GitHub Actions will automatically:
   - Validate the tag format
   - Create a GitHub release
   - Publish to npm with provenance

### Manual Release Script

Use the PowerShell script for local releases:

```powershell
# Patch release (1.0.0 -> 1.0.1)
.\scripts\release.ps1 patch

# Minor release (1.0.0 -> 1.1.0)
.\scripts\release.ps1 minor

# Major release (1.0.0 -> 2.0.0)
.\scripts\release.ps1 major

# Prerelease (1.0.0 -> 1.0.1-0)
.\scripts\release.ps1 prerelease
```

### Manual GitHub Release

Use the "Manual Release" workflow in GitHub Actions:

1. Go to Actions tab in GitHub
2. Select "Manual Release" workflow
3. Click "Run workflow"
4. Choose version type or specify exact version
5. Click "Run workflow"

## Security Features

### Vulnerability Scanning

- **npm audit**: Checks for known vulnerabilities in dependencies
- **audit-ci**: Fails CI on moderate or higher severity vulnerabilities
- **Dependabot**: Automated security updates for dependencies

### Supply Chain Security

- **Package provenance**: Cryptographic attestation of package origin
- **Dependency review**: Automated review of dependency changes in PRs
- **Security advisories**: Automatic issue creation for security findings

### Access Control

- **Branch protection**: Requires PR reviews and status checks
- **Secrets management**: Secure storage of npm tokens
- **Least privilege**: Minimal required permissions for workflows

## Monitoring and Maintenance

### Coverage Reporting

- **Threshold**: 80% coverage required for branches, functions, lines, and statements
- **Reports**: Text, LCOV, HTML, and JSON formats
- **Integration**: Codecov for coverage tracking and PR comments

### Quality Gates

- **Linting**: ESLint with TypeScript support
- **Formatting**: Prettier code formatting
- **Type checking**: TypeScript compilation verification
- **Testing**: Jest unit and integration tests

### Automated Updates

- **Dependencies**: Weekly Dependabot updates
- **Security patches**: Immediate security updates
- **GitHub Actions**: Weekly action version updates

## Troubleshooting

### Common Issues

1. **npm publish fails**: Check NPM_TOKEN secret is valid
2. **Tests fail on CI**: Ensure all tests pass locally first
3. **Security audit fails**: Update vulnerable dependencies
4. **Tag validation fails**: Use semantic versioning (v1.0.0)

### Debug Steps

1. Check workflow logs in GitHub Actions
2. Verify secrets are configured correctly
3. Ensure package.json version matches git tag
4. Run scripts locally to reproduce issues

### Support

For CI/CD issues:
1. Check GitHub Actions logs
2. Verify repository settings and secrets
3. Review workflow file syntax
4. Test scripts locally on Windows PowerShell