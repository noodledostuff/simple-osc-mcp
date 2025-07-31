# VSCode MCP Configuration Examples

This directory contains example configurations for integrating the OSC MCP Server with VSCode.

## Configuration Files

### basic-config.json
The simplest configuration using npx to run the server. Copy this to your VSCode settings.json or workspace settings.

**Usage:**
1. Open VSCode settings (Ctrl/Cmd + ,)
2. Click "Open Settings (JSON)" in the top right
3. Add the configuration from `basic-config.json`
4. Restart VSCode

### workspace-config.json
Configuration for workspace-specific settings with additional environment variables and logging.

**Usage:**
1. Create `.vscode/settings.json` in your workspace root
2. Copy the configuration from `workspace-config.json`
3. Restart VSCode

### local-install-config.json
Configuration for projects that have osc-mcp-server installed as a local dependency.

**Usage:**
1. Install locally: `npm install osc-mcp-server`
2. Add the configuration from `local-install-config.json` to your workspace settings
3. Restart VSCode

## Verification

After adding any configuration:

1. **Check MCP Panel**: Look for "osc-server" in the MCP servers list
2. **Test Connection**: The server should show as "Connected" or "Active"
3. **View Logs**: Check VSCode's output panel for any error messages

## Troubleshooting

### Server Not Appearing
- Verify Node.js 18+ is installed: `node --version`
- Check the command path is correct
- Restart VSCode after configuration changes

### Connection Errors
- Check VSCode's output panel for detailed error messages
- Verify npm/npx is accessible from VSCode's environment
- Try running `npx osc-mcp-server` manually in terminal

### Permission Issues
- Ensure the workspace has proper read/write permissions
- On Windows, try running VSCode as administrator if needed
- Check that npm global packages are accessible

## Advanced Configuration

### Custom Environment Variables

```json
{
  "mcp.servers": {
    "osc-server": {
      "command": "npx",
      "args": ["osc-mcp-server"],
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "osc-mcp-server:*"
      }
    }
  }
}
```

### Multiple Server Instances

```json
{
  "mcp.servers": {
    "osc-server-main": {
      "command": "npx",
      "args": ["osc-mcp-server"],
      "env": {}
    },
    "osc-server-test": {
      "command": "npx",
      "args": ["osc-mcp-server"],
      "env": {
        "NODE_ENV": "test"
      }
    }
  }
}
```

### Timeout Configuration

```json
{
  "mcp.servers": {
    "osc-server": {
      "command": "npx",
      "args": ["osc-mcp-server"],
      "env": {},
      "timeout": 30000
    }
  }
}
```