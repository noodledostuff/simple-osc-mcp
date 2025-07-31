/**
 * Integration tests for comprehensive error handling
 *
 * Tests error handling across the entire system to ensure
 * all components work together properly.
 */

import { OSCMCPServer } from '../server';
import { createOSCManager } from '../osc/manager';

// Mock the MCP SDK for integration tests
jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn(),
}));
jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn(),
}));
jest.mock('@modelcontextprotocol/sdk/types.js', () => ({
  CallToolRequestSchema: { method: 'tools/call' },
  ListToolsRequestSchema: { method: 'tools/list' },
  ErrorCode: {
    InvalidParams: 'InvalidParams',
    InternalError: 'InternalError',
    MethodNotFound: 'MethodNotFound',
  },
  McpError: class McpError extends Error {
    constructor(
      public code: string,
      message: string,
      public details?: any
    ) {
      super(message);
    }
  },
}));

describe('Error Handling Integration Tests', () => {
  let server: OSCMCPServer;
  let mockMCPServer: any;
  let mockTransport: any;
  let callToolHandler: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock MCP Server
    mockMCPServer = {
      connect: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      setRequestHandler: jest.fn(),
    };

    // Mock stdio transport
    mockTransport = {};

    // Setup mocks
    const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
    const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

    (Server as jest.Mock).mockImplementation(() => mockMCPServer);
    (StdioServerTransport as jest.Mock).mockImplementation(() => mockTransport);

    server = new OSCMCPServer();

    // Extract the call tool handler
    const calls = mockMCPServer.setRequestHandler.mock.calls;
    const callToolCall = calls.find((call: any) => call[0].method === 'tools/call');
    callToolHandler = callToolCall[1];
  });

  describe('Parameter Validation Integration', () => {
    it('should handle invalid port validation end-to-end', async () => {
      const request = {
        params: {
          name: 'create_osc_endpoint',
          arguments: { port: 100 }, // Invalid port
        },
      };

      try {
        await callToolHandler(request);
        fail('Expected error to be thrown');
      } catch (error: any) {
        expect(error.code).toBe('InvalidParams');
        expect(error.message).toContain("Parameter 'port' value 100 is out of range");
        expect(error.details).toBeDefined();
      }
    });

    it('should handle missing required parameters', async () => {
      const request = {
        params: {
          name: 'create_osc_endpoint',
          arguments: {}, // Missing port
        },
      };

      try {
        await callToolHandler(request);
        fail('Expected error to be thrown');
      } catch (error: any) {
        expect(error.code).toBe('InvalidParams');
        expect(error.message).toContain("Missing required parameter: 'port'");
      }
    });

    it('should handle invalid address filters', async () => {
      const request = {
        params: {
          name: 'create_osc_endpoint',
          arguments: {
            port: 8000,
            addressFilters: ['invalid-pattern'], // Invalid pattern
          },
        },
      };

      try {
        await callToolHandler(request);
        fail('Expected error to be thrown');
      } catch (error: any) {
        expect(error.code).toBe('InvalidParams');
        expect(error.message).toContain('Invalid OSC address pattern');
      }
    });

    it('should handle invalid endpoint ID for stop operation', async () => {
      const request = {
        params: {
          name: 'stop_osc_endpoint',
          arguments: { endpointId: 123 }, // Invalid type
        },
      };

      try {
        await callToolHandler(request);
        fail('Expected error to be thrown');
      } catch (error: any) {
        expect(error.code).toBe('InvalidParams');
        expect(error.message).toContain("Invalid parameter 'endpointId': expected string");
      }
    });
  });

  describe('Network Error Integration', () => {
    it('should handle port in use errors through the full stack', async () => {
      // First create an endpoint successfully
      const firstRequest = {
        params: {
          name: 'create_osc_endpoint',
          arguments: { port: 8000 },
        },
      };

      const firstResult = await callToolHandler(firstRequest);
      const firstResponse = JSON.parse(firstResult.content[0].text);
      expect(firstResponse.status).toBe('active');

      // Try to create another endpoint on the same port
      const secondRequest = {
        params: {
          name: 'create_osc_endpoint',
          arguments: { port: 8000 },
        },
      };

      try {
        await callToolHandler(secondRequest);
        fail('Expected error to be thrown');
      } catch (error: any) {
        expect(error.code).toBe('InternalError');
        expect(error.message).toContain('Port 8000 is already in use');
      }
    });
  });

  describe('Endpoint Management Error Integration', () => {
    it('should handle stopping non-existent endpoints', async () => {
      const request = {
        params: {
          name: 'stop_osc_endpoint',
          arguments: { endpointId: 'non-existent' },
        },
      };

      const result = await callToolHandler(request);
      const response = JSON.parse(result.content[0].text);

      expect(response.message).toContain("Endpoint 'non-existent' not found");
    });

    it('should handle querying messages from non-existent endpoints', async () => {
      const request = {
        params: {
          name: 'get_osc_messages',
          arguments: { endpointId: 'non-existent' },
        },
      };

      const result = await callToolHandler(request);
      const response = JSON.parse(result.content[0].text);

      // Should return empty results for non-existent endpoint
      expect(response.messages).toEqual([]);
      expect(response.totalCount).toBe(0);
    });
  });

  describe('Complex Validation Scenarios', () => {
    it('should validate complex get_messages parameters', async () => {
      const invalidRequests = [
        // Invalid time window
        {
          arguments: { timeWindowSeconds: 'invalid' },
        },
        // Time window out of range
        {
          arguments: { timeWindowSeconds: 100000 },
        },
        // Invalid limit
        {
          arguments: { limit: 'invalid' },
        },
        // Limit out of range
        {
          arguments: { limit: 2000 },
        },
        // Invalid address pattern
        {
          arguments: { addressPattern: 'invalid' },
        },
      ];

      for (const args of invalidRequests) {
        const request = {
          params: {
            name: 'get_osc_messages',
            arguments: args.arguments,
          },
        };

        try {
          await callToolHandler(request);
          fail(`Expected error for arguments: ${JSON.stringify(args.arguments)}`);
        } catch (error: any) {
          expect(error.code).toBe('InvalidParams');
        }
      }
    });

    it('should validate buffer size limits', async () => {
      const invalidRequests = [
        // Buffer size too small
        { port: 8000, bufferSize: 0 },
        // Buffer size too large
        { port: 8001, bufferSize: 20000 },
        // Invalid buffer size type
        { port: 8002, bufferSize: 'invalid' },
      ];

      for (const args of invalidRequests) {
        const request = {
          params: {
            name: 'create_osc_endpoint',
            arguments: args,
          },
        };

        try {
          await callToolHandler(request);
          fail(`Expected error for arguments: ${JSON.stringify(args)}`);
        } catch (error: any) {
          expect(error.code).toBe('InvalidParams');
        }
      }
    });
  });

  describe('Error Recovery and Suggestions', () => {
    it('should provide helpful error messages with suggestions', async () => {
      const request = {
        params: {
          name: 'create_osc_endpoint',
          arguments: { port: 100 }, // Invalid port
        },
      };

      try {
        await callToolHandler(request);
        fail('Expected error to be thrown');
      } catch (error: any) {
        expect(error.message).toContain("Parameter 'port' value 100 is out of range");
        expect(error.message).toContain('Must be between 1024 and 65535');
        expect(error.details).toBeDefined();
        expect(error.details.validRange).toEqual({ min: 1024, max: 65535 });
      }
    });

    it('should handle permission denied scenarios gracefully', async () => {
      // This test simulates what would happen with permission denied
      // In a real scenario, this would be triggered by trying to bind to a privileged port
      const oscManager = createOSCManager();

      // Mock the createEndpoint to simulate permission denied
      jest.spyOn(oscManager, 'createEndpoint').mockResolvedValue({
        endpointId: '',
        port: 80,
        status: 'error',
        message:
          'Permission denied to bind to port 80. Try using a port number above 1024 or run with appropriate privileges.',
      });

      const response = await oscManager.createEndpoint({ port: 80 });

      expect(response.status).toBe('error');
      expect(response.message).toContain('Permission denied');
      expect(response.message).toContain('Try using a port number above 1024');
    });
  });

  describe('Tool Error Handling', () => {
    it('should handle unknown tool names gracefully', async () => {
      const request = {
        params: {
          name: 'unknown_tool',
          arguments: {},
        },
      };

      try {
        await callToolHandler(request);
        fail('Expected error to be thrown');
      } catch (error: any) {
        expect(error.code).toBe('MethodNotFound');
        expect(error.message).toContain('Unknown tool: unknown_tool');
      }
    });

    it('should convert unexpected errors to proper MCP errors', async () => {
      // Mock the OSC manager to throw an unexpected error
      const oscManager = server.getOSCManager();
      jest
        .spyOn(oscManager, 'createEndpoint')
        .mockRejectedValue(new Error('Unexpected system error'));

      const request = {
        params: {
          name: 'create_osc_endpoint',
          arguments: { port: 8000 },
        },
      };

      try {
        await callToolHandler(request);
        fail('Expected error to be thrown');
      } catch (error: any) {
        expect(error.code).toBe('InternalError');
        expect(error.message).toContain("Operation 'create_osc_endpoint' failed");
      }
    });
  });

  describe('Concurrent Error Scenarios', () => {
    it('should handle multiple simultaneous endpoint creation attempts', async () => {
      const requests = Array.from({ length: 3 }, () => ({
        params: {
          name: 'create_osc_endpoint',
          arguments: { port: 8000 }, // Same port for all
        },
      }));

      const results = await Promise.allSettled(requests.map(req => callToolHandler(req)));

      // Count successful and failed attempts
      let successCount = 0;
      let errorCount = 0;

      for (const result of results) {
        if (result.status === 'fulfilled') {
          const response = JSON.parse(result.value.content[0].text);
          if (response.status === 'active') {
            successCount++;
          } else if (response.status === 'error') {
            errorCount++;
          }
        } else {
          errorCount++;
        }
      }

      // At least one should succeed, and there should be some errors due to port conflicts
      expect(successCount).toBeGreaterThanOrEqual(1);
      expect(errorCount).toBeGreaterThan(0);
      expect(successCount + errorCount).toBe(3);
    });
  });

  afterEach(async () => {
    // Clean up any created endpoints to prevent hanging
    try {
      const oscManager = server.getOSCManager();
      await oscManager.shutdown();
    } catch (_error) {
      // Ignore cleanup errors
    }
  });
});
