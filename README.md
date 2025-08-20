# Simple OSC MCP Server

[![CI/CD Pipeline](https://github.com/noodledostuff/simple-osc-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/noodledostuff/simple-osc-mcp/actions/workflows/ci.yml)
[![Security Scan](https://github.com/noodledostuff/simple-osc-mcp/actions/workflows/security.yml/badge.svg)](https://github.com/noodledostuff/simple-osc-mcp/actions/workflows/security.yml)
[![npm version](https://badge.fury.io/js/osc-mcp-server.svg)](https://badge.fury.io/js/osc-mcp-server)

A Model Context Protocol (MCP) server that enables AI agents to create OSC (Open Sound Control) endpoints and receive OSC messages. This server provides a bridge between AI agents and OSC-enabled applications like SuperCollider, Max/MSP, TouchOSC, and other music/audio software.

## Features

- **OSC Endpoint Management**: Create and manage multiple UDP endpoints for receiving OSC messages
- **Message Buffering**: Store and query received OSC messages with configurable buffer sizes
- **Pattern Filtering**: Filter messages by OSC address patterns for targeted data collection
- **VSCode Integration**: Full compatibility with VSCode's MCP client for seamless development workflow
- **Real-time Monitoring**: Track endpoint status and message flow in real-time
- **Type Safety**: Built with TypeScript for robust type checking and better developer experience

## Installation

### Quick Start with npx (Recommended)

```bash
npx osc-mcp-server
```

### Global Installation

```bash
npm install -g osc-mcp-server
osc-mcp-server
```

### Local Installation

```bash
npm install osc-mcp-server
npx osc-mcp-server
```

## Requirements

- **Node.js**: 18.0.0 or higher
- **Operating System**: Windows, macOS, or Linux
- **Network**: UDP port access for OSC communication (ports 1024-65535)

## Usage

### VSCode Integration

The OSC MCP Server is designed to work seamlessly with VSCode's MCP client. To configure it:

1. **Install the MCP extension** in VSCode (if not already installed)

2. **Add server configuration** to your VSCode settings or workspace `.vscode/settings.json`:

```json
{
  "mcp.servers": {
    "osc-server": {
      "command": "npx",
      "args": ["osc-mcp-server"],
      "env": {}
    }
  }
}
```

3. **Restart VSCode** to load the server

4. **Verify connection** by checking the MCP panel in VSCode - you should see "osc-server" listed as active

### Available Tools

The server provides four main tools for OSC interaction:

#### 1. create_osc_endpoint

Creates a new OSC endpoint to listen for incoming messages.

**Parameters:**
- `port` (required): UDP port number (1024-65535)
- `bufferSize` (optional): Maximum messages to store (default: 1000, max: 10000)
- `addressFilters` (optional): Array of OSC address patterns to filter messages

**Example:**
```json
{
  "port": 8000,
  "bufferSize": 500,
  "addressFilters": ["/synth/*", "/effects/reverb"]
}
```

#### 2. stop_osc_endpoint

Stops and removes an existing OSC endpoint.

**Parameters:**
- `endpointId` (required): ID of the endpoint to stop

**Example:**
```json
{
  "endpointId": "endpoint_8000_1234567890"
}
```

#### 3. get_osc_messages

Queries received OSC messages from endpoints.

**Parameters:**
- `endpointId` (optional): Specific endpoint ID (if omitted, queries all endpoints)
- `addressPattern` (optional): OSC address pattern to filter messages
- `timeWindowSeconds` (optional): Time window in seconds (from now backwards)
- `limit` (optional): Maximum number of messages to return (max: 1000)

**Example:**
```json
{
  "endpointId": "endpoint_8000_1234567890",
  "addressPattern": "/synth/freq",
  "timeWindowSeconds": 30,
  "limit": 50
}
```

#### 4. get_endpoint_status

Gets status information for OSC endpoints.

**Parameters:**
- `endpointId` (optional): Specific endpoint ID (if omitted, returns all endpoints)

**Example:**
```json
{
  "endpointId": "endpoint_8000_1234567890"
}
```

### Command Line Usage

When running the server directly, it starts in stdio mode for MCP communication:

```bash
# Start the server
npx osc-mcp-server

# The server will output startup information to stderr
# and handle MCP communication via stdin/stdout
```

### Example Workflow

Here's a typical workflow for using the OSC MCP Server:

1. **Create an endpoint** to listen for OSC messages:
   ```json
   {
     "tool": "create_osc_endpoint",
     "parameters": {
       "port": 8000,
       "bufferSize": 1000,
       "addressFilters": ["/synth/*"]
     }
   }
   ```

2. **Send OSC messages** from your application (SuperCollider, Max/MSP, etc.) to `localhost:8000`

3. **Query received messages**:
   ```json
   {
     "tool": "get_osc_messages",
     "parameters": {
       "timeWindowSeconds": 60,
       "limit": 100
     }
   }
   ```

4. **Check endpoint status**:
   ```json
   {
     "tool": "get_endpoint_status",
     "parameters": {}
   }
   ```

5. **Stop the endpoint** when done:
   ```json
   {
     "tool": "stop_osc_endpoint",
     "parameters": {
       "endpointId": "endpoint_8000_1234567890"
     }
   }
   ```

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

## Troubleshooting

### Common Issues

#### Server Connection Issues

**Problem**: VSCode shows "osc-server" as disconnected or not listed
- **Solution**: Check that Node.js 18+ is installed and accessible
- **Solution**: Verify the MCP configuration in VSCode settings
- **Solution**: Restart VSCode after configuration changes
- **Solution**: Check VSCode's output panel for MCP-related error messages

**Problem**: "Command not found" error when using npx
- **Solution**: Ensure npm is installed and up to date: `npm install -g npm@latest`
- **Solution**: Clear npm cache: `npm cache clean --force`
- **Solution**: Try installing globally first: `npm install -g osc-mcp-server`

#### OSC Endpoint Issues

**Problem**: "Port already in use" error
- **Solution**: Choose a different port number (1024-65535)
- **Solution**: Check what's using the port: `netstat -an | grep :8000` (replace 8000 with your port)
- **Solution**: Stop other applications using the same port

**Problem**: "Permission denied" error on low port numbers
- **Solution**: Use ports 1024 and above (ports below 1024 require admin privileges)
- **Solution**: On Linux/macOS, run with sudo only if absolutely necessary

**Problem**: No OSC messages received
- **Solution**: Verify the sending application is configured to send to the correct IP and port
- **Solution**: Check firewall settings - ensure UDP traffic is allowed on the specified port
- **Solution**: Test with a simple OSC sender like TouchOSC or SuperCollider
- **Solution**: Verify address filters aren't too restrictive

#### Message Query Issues

**Problem**: Empty message results when messages should exist
- **Solution**: Check the time window - messages might be older than the specified timeWindowSeconds
- **Solution**: Verify address pattern matching - OSC patterns are case-sensitive
- **Solution**: Check if endpoint buffer size was exceeded (older messages get removed)

**Problem**: "Endpoint not found" error
- **Solution**: Use `get_endpoint_status` to list available endpoint IDs
- **Solution**: Verify the endpoint wasn't stopped or crashed
- **Solution**: Check for typos in the endpoint ID

### Performance Considerations

#### High-Frequency Messages

If you're receiving many OSC messages per second:
- **Increase buffer size** to prevent message loss: `"bufferSize": 5000`
- **Use address filters** to reduce processing overhead
- **Query messages more frequently** to prevent buffer overflow
- **Consider multiple endpoints** for different message types

#### Memory Usage

- **Monitor buffer sizes** - larger buffers use more memory
- **Set appropriate limits** on message queries to avoid large responses
- **Stop unused endpoints** to free resources

### Network Configuration

#### Firewall Settings

**Windows**:
```cmd
# Allow UDP traffic on port 8000 (replace with your port)
netsh advfirewall firewall add rule name="OSC MCP Server" dir=in action=allow protocol=UDP localport=8000
```

**macOS**:
```bash
# Check if firewall is blocking the port
sudo pfctl -sr | grep 8000
```

**Linux (Ubuntu/Debian)**:
```bash
# Allow UDP traffic on port 8000
sudo ufw allow 8000/udp
```

#### Testing OSC Communication

Use these tools to test OSC message sending:

**SuperCollider**:
```supercollider
// Send a test message
n = NetAddr("127.0.0.1", 8000);
n.sendMsg("/test", 440, "hello");
```

**Max/MSP**:
```
[udpsend 127.0.0.1 8000]
|
[/test 440 hello(
```

**Python (python-osc)**:
```python
from pythonosc import udp_client

client = udp_client.SimpleUDPClient("127.0.0.1", 8000)
client.send_message("/test", [440, "hello"])
```

### Debug Mode

For detailed logging, you can check the stderr output when running the server:

```bash
npx osc-mcp-server 2> debug.log
```

This will capture all debug messages to a file for analysis.

### Getting Help

If you encounter issues not covered here:

1. **Check the GitHub Issues**: [https://github.com/username/osc-mcp-server/issues](https://github.com/username/osc-mcp-server/issues)
2. **Create a new issue** with:
   - Your operating system and Node.js version
   - Complete error messages
   - Steps to reproduce the problem
   - Your MCP configuration

## Documentation

### API Reference
- **[Complete API Reference](docs/API-REFERENCE.md)** - Detailed documentation of all MCP tools and their parameters

### Examples and Workflows
- **[Examples Overview](examples/README.md)** - All available examples and configurations
- **[VSCode Configuration](examples/vscode/README.md)** - VSCode MCP client setup examples
- **[OSC Senders](examples/osc-senders/README.md)** - Test OSC message senders for various platforms
- **[Workflow Examples](examples/workflows/README.md)** - Step-by-step usage workflows

### Specific Workflows
- **[Basic Workflow](examples/workflows/basic-workflow.md)** - Getting started with a single endpoint
- **[Multi-Endpoint Workflow](examples/workflows/multi-endpoint-workflow.md)** - Managing multiple OSC sources

### Development
- **[CI/CD Documentation](docs/CI-CD.md)** - Continuous integration and deployment details

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
