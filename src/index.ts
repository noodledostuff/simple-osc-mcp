#!/usr/bin/env node

/**
 * OSC MCP Server - CLI Entry Point
 *
 * This is the main entry point for the OSC MCP server that can be executed via npx.
 * It sets up the MCP server with command-line argument parsing and handles graceful shutdown.
 * Designed for full VSCode compatibility with stdio transport support.
 */

import { OSCMCPServer } from './server.js';

/**
 * Server configuration options from command line arguments
 */
interface ServerConfig {
  /** Enable debug logging */
  debug: boolean;
  /** Show help information */
  help: boolean;
  /** Show version information */
  version: boolean;
  /** Log level for VSCode integration */
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

/**
 * Parse command line arguments into server configuration
 */
function parseArguments(): ServerConfig {
  const args = process.argv.slice(2);
  const config: ServerConfig = {
    debug: false,
    help: false,
    version: false,
    logLevel: 'error',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (!arg) continue;

    switch (arg) {
      case '--debug':
      case '-d':
        config.debug = true;
        config.logLevel = 'debug';
        break;

      case '--help':
      case '-h':
        config.help = true;
        break;

      case '--version':
      case '-v':
        config.version = true;
        break;

      case '--log-level': {
        const nextArg = args[i + 1];
        if (nextArg && ['error', 'warn', 'info', 'debug'].includes(nextArg)) {
          config.logLevel = nextArg as ServerConfig['logLevel'];
          i++; // Skip next argument as it's the log level value
        } else {
          console.error('Invalid log level. Must be one of: error, warn, info, debug');
          process.exit(1);
        }
        break;
      }

      default:
        if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}`);
          console.error('Use --help for usage information');
          process.exit(1);
        }
        break;
    }
  }

  return config;
}

/**
 * Display help information
 */
function showHelp(): void {
  console.log(`
OSC MCP Server - Model Context Protocol server for OSC endpoint management

USAGE:
  npx osc-mcp-server [OPTIONS]

OPTIONS:
  -d, --debug           Enable debug logging
  -h, --help           Show this help message
  -v, --version        Show version information
  --log-level LEVEL    Set log level (error, warn, info, debug)

DESCRIPTION:
  The OSC MCP Server provides AI agents with tools to create OSC (Open Sound Control)
  endpoints and receive OSC messages. It implements the Model Context Protocol (MCP)
  for seamless integration with AI development environments like VSCode.

  The server uses stdio transport for communication, making it fully compatible with
  VSCode's MCP client implementation.

TOOLS PROVIDED:
  - create_osc_endpoint    Create new OSC listening endpoint
  - stop_osc_endpoint      Stop and cleanup OSC endpoint  
  - get_osc_messages       Query received OSC messages
  - get_endpoint_status    Get status of OSC endpoints

EXAMPLES:
  # Start server with default settings
  npx osc-mcp-server

  # Start server with debug logging
  npx osc-mcp-server --debug

  # Start server with specific log level
  npx osc-mcp-server --log-level info

For more information, visit: https://github.com/your-repo/osc-mcp-server
`);
}

/**
 * Display version information
 */
function showVersion(): void {
  // Read version from package.json
  try {
    const packageJson = require('../package.json');
    console.log(`OSC MCP Server v${packageJson.version}`);
    console.log(`Node.js ${process.version}`);
    console.log(`Platform: ${process.platform} ${process.arch}`);
  } catch {
    console.log('OSC MCP Server v1.0.0');
    console.log(`Node.js ${process.version}`);
    console.log(`Platform: ${process.platform} ${process.arch}`);
  }
}

/**
 * Set up VSCode-compatible logging based on configuration
 */
function setupLogging(config: ServerConfig): void {
  // Store original console methods
  const originalError = console.error;

  // Create logging functions that respect log level and use stderr for VSCode compatibility
  const logLevels = { error: 0, warn: 1, info: 2, debug: 3 };
  const currentLevel = logLevels[config.logLevel];

  console.error = (...args: any[]) => {
    if (currentLevel >= logLevels.error) {
      originalError('[OSC-MCP-SERVER ERROR]', ...args);
    }
  };

  console.warn = (...args: any[]) => {
    if (currentLevel >= logLevels.warn) {
      originalError('[OSC-MCP-SERVER WARN]', ...args);
    }
  };

  console.log = (...args: any[]) => {
    if (currentLevel >= logLevels.info) {
      originalError('[OSC-MCP-SERVER INFO]', ...args);
    }
  };

  console.debug = (...args: any[]) => {
    if (currentLevel >= logLevels.debug) {
      originalError('[OSC-MCP-SERVER DEBUG]', ...args);
    }
  };

  // Add timestamp to debug logs
  if (config.debug) {
    const originalConsoleDebug = console.debug;
    console.debug = (...args: any[]) => {
      const timestamp = new Date().toISOString();
      originalConsoleDebug(`[${timestamp}]`, ...args);
    };
  }
}

/**
 * Set up graceful shutdown handlers with connection lifecycle management
 */
function setupShutdownHandlers(server: OSCMCPServer): void {
  let isShuttingDown = false;

  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) {
      console.error(`Received ${signal} again, forcing exit...`);
      process.exit(1);
    }

    isShuttingDown = true;
    console.error(`\nReceived ${signal}, shutting down gracefully...`);

    try {
      // Set a timeout for shutdown to prevent hanging
      const shutdownTimeout = setTimeout(() => {
        console.error('Shutdown timeout reached, forcing exit...');
        process.exit(1);
      }, 10000); // 10 second timeout

      await server.shutdown();
      clearTimeout(shutdownTimeout);

      console.error('OSC MCP Server shut down successfully');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Handle various shutdown signals
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  // Handle uncaught exceptions and unhandled rejections
  process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
    gracefulShutdown('uncaughtException').catch(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection').catch(() => process.exit(1));
  });

  // Handle VSCode-specific connection events
  process.stdin.on('close', () => {
    console.error('Stdin closed, shutting down server...');
    gracefulShutdown('stdin-close').catch(() => process.exit(1));
  });

  process.stdin.on('error', error => {
    console.error('Stdin error:', error);
    gracefulShutdown('stdin-error').catch(() => process.exit(1));
  });
}

/**
 * Validate Node.js version compatibility
 */
function validateNodeVersion(): void {
  const nodeVersion = process.version;
  const versionParts = nodeVersion.slice(1).split('.');
  const majorVersionStr = versionParts[0];

  if (!majorVersionStr) {
    console.error('Unable to parse Node.js version');
    process.exit(1);
  }

  const majorVersion = parseInt(majorVersionStr);

  if (majorVersion < 18) {
    console.error(`Node.js version ${nodeVersion} is not supported.`);
    console.error('OSC MCP Server requires Node.js 18.0.0 or higher.');
    console.error('Please upgrade your Node.js installation.');
    process.exit(1);
  }
}

/**
 * Main entry point with enhanced CLI support and VSCode compatibility
 */
export async function main(): Promise<void> {
  let config: ServerConfig | undefined;

  try {
    // Validate Node.js version first
    validateNodeVersion();

    // Parse command line arguments
    config = parseArguments();

    // Handle help and version flags
    if (config.help) {
      showHelp();
      return;
    }

    if (config.version) {
      showVersion();
      return;
    }

    // Set up logging for VSCode compatibility
    setupLogging(config);

    // Log startup information
    if (config.debug) {
      console.debug('Starting OSC MCP Server with configuration:', config);
      console.debug('Node.js version:', process.version);
      console.debug('Platform:', process.platform, process.arch);
    }

    // Create and configure server
    const server = new OSCMCPServer();

    // Set up graceful shutdown handlers
    setupShutdownHandlers(server);

    // Start the server
    console.debug('Initializing MCP server with stdio transport...');
    await server.start();

    console.error('OSC MCP Server started successfully');
    console.debug('Server is ready to accept MCP requests via stdio transport');

    // Keep the process alive - the server will handle stdio communication
    // No need for additional event loop management as MCP handles this
  } catch (error) {
    console.error('Failed to start OSC MCP Server:', error);

    if (error instanceof Error) {
      console.error('Error details:', error.message);
      if (process.env['NODE_ENV'] === 'development' || config?.debug) {
        console.error('Stack trace:', error.stack);
      }
    }

    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error in main:', error);
    process.exit(1);
  });
}
