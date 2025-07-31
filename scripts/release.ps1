# Release script for osc-mcp-server
# Usage: .\scripts\release.ps1 [patch|minor|major|prerelease]

param(
    [string]$ReleaseType = "patch"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting release process..." -ForegroundColor Green

# Check if we're on main branch
$currentBranch = git branch --show-current
if ($currentBranch -ne "main") {
    Write-Host "❌ Error: Must be on main branch to release. Current branch: $currentBranch" -ForegroundColor Red
    exit 1
}

# Check if working directory is clean
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "❌ Error: Working directory is not clean. Please commit or stash changes." -ForegroundColor Red
    exit 1
}

# Pull latest changes
Write-Host "📥 Pulling latest changes..." -ForegroundColor Yellow
git pull origin main

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm ci

# Run tests
Write-Host "🧪 Running tests..." -ForegroundColor Yellow
npm test

# Run linting
Write-Host "🔍 Running linting..." -ForegroundColor Yellow
npm run lint

# Check formatting
Write-Host "✨ Checking formatting..." -ForegroundColor Yellow
npm run format:check

# Build project
Write-Host "🔨 Building project..." -ForegroundColor Yellow
npm run build

# Bump version
Write-Host "📈 Bumping version ($ReleaseType)..." -ForegroundColor Yellow
$newVersion = npm version $ReleaseType --no-git-tag-version

Write-Host "✅ Version bumped to $newVersion" -ForegroundColor Green

# Commit and tag
Write-Host "📝 Committing version bump..." -ForegroundColor Yellow
git add package.json package-lock.json
git commit -m "chore: bump version to $newVersion"
git tag "$newVersion"

# Push changes
Write-Host "🚀 Pushing changes..." -ForegroundColor Yellow
git push origin main
git push origin "$newVersion"

Write-Host "✅ Release $newVersion completed successfully!" -ForegroundColor Green
Write-Host "🎉 GitHub Actions will now handle the npm publishing process." -ForegroundColor Cyan