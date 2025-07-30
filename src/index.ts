#!/usr/bin/env node

/**
 * OSC MCP Server - CLI Entry Point
 *
 * This is the main entry point for the OSC MCP server that can be executed via npx.
 * It sets up the MCP server and handles graceful shutdown.
 */

import { OSCMCPServer } from './server.js';

async function main(): Promise<void> {
  const server = new OSCMCPServer();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    server
      .shutdown()
      .then(() => process.exit(0))
      .catch(error => {
        console.error('Error during shutdown:', error);
        process.exit(1);
      });
  });

  process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM, shutting down gracefully...');
    server
      .shutdown()
      .then(() => process.exit(0))
      .catch(error => {
        console.error('Error during shutdown:', error);
        process.exit(1);
      });
  });

  try {
    await server.start();
    console.log('OSC MCP Server started successfully');
  } catch (error) {
    console.error('Failed to start OSC MCP Server:', error);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}
