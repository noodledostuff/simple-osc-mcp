# OSC MCP Server

[![CI/CD Pipeline](https://github.com/username/osc-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/username/osc-mcp-server/actions/workflows/ci.yml)
[![Security Scan](https://github.com/username/osc-mcp-server/actions/workflows/security.yml/badge.svg)](https://github.com/username/osc-mcp-server/actions/workflows/security.yml)
[![npm version](https://badge.fury.io/js/osc-mcp-server.svg)](https://badge.fury.io/js/osc-mcp-server)

A Model Context Protocol (MCP) server that enables AI agents to create OSC (Open Sound Control) endpoints and receive OSC messages.

## Installation

```bash
npx osc-mcp-server
```

## Requirements

- Node.js 18.0.0 or higher

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format
```

## CI/CD Pipeline

This project uses GitHub Actions for continuous integration and deployment:

- **Automated Testing**: Runs on Node.js 18, 20, and 22
- **Code Quality**: ESLint, Prettier, and TypeScript checks
- **Security Scanning**: npm audit and vulnerability scanning
- **Coverage Reporting**: 80% coverage threshold required
- **Automated Publishing**: Publishes to npm on tagged releases

### Release Process

Create a new release by pushing a git tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Or use the PowerShell release script:

```powershell
.\scripts\release.ps1 patch  # or minor, major, prerelease
```

For detailed CI/CD documentation, see [docs/CI-CD.md](docs/CI-CD.md).

## License

MIT