/**
 * Unit tests for OSC MCP Server
 *
 * Tests MCP protocol handling, tool registration, and VSCode compatibility
 */

import { OSCMCPServer } from './server';
import { OSCManager } from './osc/manager';
import {
  CreateEndpointResponse,
  StopEndpointResponse,
  MessageQueryResponse,
  EndpointStatusResponse,
  OSCMessage,
  OSCEndpointInfo,
} from './types/index';

// Mock the MCP SDK
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
      message: string
    ) {
      super(message);
    }
  },
}));
jest.mock('./osc/manager');

describe('OSCMCPServer', () => {
  let server: OSCMCPServer;
  let mockOSCManager: jest.Mocked<OSCManager>;
  let mockMCPServer: any;
  let mockTransport: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock MCP Server
    mockMCPServer = {
      connect: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      setRequestHandler: jest.fn(),
    };

    // Mock stdio transport
    mockTransport = {};

    // Mock OSC Manager
    mockOSCManager = {
      createEndpoint: jest.fn(),
      stopEndpoint: jest.fn(),
      getMessages: jest.fn(),
      getEndpointStatus: jest.fn(),
      shutdown: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    } as any;

    // Setup mocks
    const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
    const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
    const { createOSCManager } = require('./osc/manager');

    (Server as jest.Mock).mockImplementation(() => mockMCPServer);
    (StdioServerTransport as jest.Mock).mockImplementation(() => mockTransport);
    (createOSCManager as jest.Mock).mockReturnValue(mockOSCManager);

    server = new OSCMCPServer();
  });

  describe('Constructor', () => {
    it('should initialize MCP server with correct configuration', () => {
      const { Server } = require('@modelcontextprotocol/sdk/server/index.js');

      expect(Server).toHaveBeenCalledWith({
        name: 'osc-mcp-server',
        version: '1.0.0',
      });
    });

    it('should create OSC manager instance', () => {
      const { createOSCManager } = require('./osc/manager');
      expect(createOSCManager).toHaveBeenCalled();
    });

    it('should set up request handlers', () => {
      expect(mockMCPServer.setRequestHandler).toHaveBeenCalledTimes(2);
    });

    it('should set up OSC manager event handlers', () => {
      expect(mockOSCManager.on).toHaveBeenCalledWith('endpointCreated', expect.any(Function));
      expect(mockOSCManager.on).toHaveBeenCalledWith('endpointStopped', expect.any(Function));
      expect(mockOSCManager.on).toHaveBeenCalledWith('endpointError', expect.any(Function));
      expect(mockOSCManager.on).toHaveBeenCalledWith('messageReceived', expect.any(Function));
    });
  });

  describe('Server Lifecycle', () => {
    describe('start()', () => {
      it('should start server successfully', async () => {
        await server.start();

        expect(mockMCPServer.connect).toHaveBeenCalledWith(mockTransport);
        expect(server.isServerRunning()).toBe(true);
      });

      it('should throw error if server is already running', async () => {
        await server.start();

        await expect(server.start()).rejects.toThrow('Server is already running');
      });

      it('should handle connection errors', async () => {
        const error = new Error('Connection failed');
        mockMCPServer.connect.mockRejectedValue(error);

        await expect(server.start()).rejects.toThrow(
          'Failed to start MCP server: Connection failed'
        );
      });
    });

    describe('shutdown()', () => {
      it('should shutdown server gracefully', async () => {
        await server.start();
        await server.shutdown();

        expect(mockOSCManager.shutdown).toHaveBeenCalled();
        expect(mockMCPServer.close).toHaveBeenCalled();
        expect(server.isServerRunning()).toBe(false);
      });

      it('should handle shutdown when server is not running', async () => {
        await server.shutdown();

        expect(mockOSCManager.shutdown).not.toHaveBeenCalled();
        expect(mockMCPServer.close).not.toHaveBeenCalled();
      });

      it('should handle shutdown errors gracefully', async () => {
        await server.start();

        const error = new Error('Shutdown failed');
        mockOSCManager.shutdown.mockRejectedValue(error);

        // Should not throw, but handle error gracefully
        await server.shutdown();

        // Server should still be marked as not running even if shutdown had errors
        expect(server.isServerRunning()).toBe(false);
      });
    });
  });

  describe('Tool Registration', () => {
    let listToolsHandler: any;

    beforeEach(() => {
      // Extract the list tools handler
      const calls = mockMCPServer.setRequestHandler.mock.calls;
      const listToolsCall = calls.find((call: any) => call[0].method === 'tools/list');
      listToolsHandler = listToolsCall[1];
    });

    it('should register all OSC tools', async () => {
      const result = await listToolsHandler();

      expect(result.tools).toHaveLength(4);

      const toolNames = result.tools.map((tool: any) => tool.name);
      expect(toolNames).toContain('create_osc_endpoint');
      expect(toolNames).toContain('stop_osc_endpoint');
      expect(toolNames).toContain('get_osc_messages');
      expect(toolNames).toContain('get_endpoint_status');
    });

    it('should provide proper tool schemas', async () => {
      const result = await listToolsHandler();

      const createEndpointTool = result.tools.find(
        (tool: any) => tool.name === 'create_osc_endpoint'
      );
      expect(createEndpointTool.inputSchema.properties.port).toBeDefined();
      expect(createEndpointTool.inputSchema.properties.port.minimum).toBe(1024);
      expect(createEndpointTool.inputSchema.properties.port.maximum).toBe(65535);
      expect(createEndpointTool.inputSchema.required).toContain('port');
    });
  });

  describe('Tool Execution', () => {
    let callToolHandler: any;

    beforeEach(() => {
      // Extract the call tool handler
      const calls = mockMCPServer.setRequestHandler.mock.calls;
      const callToolCall = calls.find((call: any) => call[0].method === 'tools/call');
      callToolHandler = callToolCall[1];
    });

    describe('create_osc_endpoint', () => {
      it('should create endpoint successfully', async () => {
        const mockResponse: CreateEndpointResponse = {
          endpointId: 'endpoint-1',
          port: 8000,
          status: 'active',
          message: 'OSC endpoint created successfully on port 8000',
        };

        mockOSCManager.createEndpoint.mockResolvedValue(mockResponse);

        const request = {
          params: {
            name: 'create_osc_endpoint',
            arguments: {
              port: 8000,
              bufferSize: 1000,
              addressFilters: ['/synth/*'],
            },
          },
        };

        const result = await callToolHandler(request);

        expect(mockOSCManager.createEndpoint).toHaveBeenCalledWith({
          port: 8000,
          bufferSize: 1000,
          addressFilters: ['/synth/*'],
        });

        expect(result.content[0].type).toBe('text');
        expect(JSON.parse(result.content[0].text)).toEqual(mockResponse);
      });

      it('should validate port parameter', async () => {
        const request = {
          params: {
            name: 'create_osc_endpoint',
            arguments: {
              port: 500, // Invalid port
            },
          },
        };

        await expect(callToolHandler(request)).rejects.toThrow();
      });

      it('should handle endpoint creation errors', async () => {
        const mockResponse: CreateEndpointResponse = {
          endpointId: '',
          port: 8000,
          status: 'error',
          message: 'Port 8000 is already in use',
        };

        mockOSCManager.createEndpoint.mockResolvedValue(mockResponse);

        const request = {
          params: {
            name: 'create_osc_endpoint',
            arguments: { port: 8000 },
          },
        };

        await expect(callToolHandler(request)).rejects.toThrow();
      });
    });

    describe('stop_osc_endpoint', () => {
      it('should stop endpoint successfully', async () => {
        const mockResponse: StopEndpointResponse = {
          endpointId: 'endpoint-1',
          message: 'Endpoint endpoint-1 stopped successfully',
        };

        mockOSCManager.stopEndpoint.mockResolvedValue(mockResponse);

        const request = {
          params: {
            name: 'stop_osc_endpoint',
            arguments: { endpointId: 'endpoint-1' },
          },
        };

        const result = await callToolHandler(request);

        expect(mockOSCManager.stopEndpoint).toHaveBeenCalledWith('endpoint-1');
        expect(JSON.parse(result.content[0].text)).toEqual(mockResponse);
      });

      it('should validate endpointId parameter', async () => {
        const request = {
          params: {
            name: 'stop_osc_endpoint',
            arguments: {}, // Missing endpointId
          },
        };

        await expect(callToolHandler(request)).rejects.toThrow();
      });
    });

    describe('get_osc_messages', () => {
      it('should query messages successfully', async () => {
        const mockMessages: OSCMessage[] = [
          {
            timestamp: new Date('2024-01-01T12:00:00Z'),
            address: '/synth/freq',
            typeTags: 'f',
            arguments: [440.0],
            sourceIp: '192.168.1.100',
            sourcePort: 57120,
          },
        ];

        const expectedResponse = {
          messages: [
            {
              timestamp: '2024-01-01T12:00:00.000Z',
              address: '/synth/freq',
              typeTags: 'f',
              arguments: [440.0],
              sourceIp: '192.168.1.100',
              sourcePort: 57120,
            },
          ],
          totalCount: 1,
          filteredCount: 1,
        };

        const mockResponse: MessageQueryResponse = {
          messages: mockMessages,
          totalCount: 1,
          filteredCount: 1,
        };

        mockOSCManager.getMessages.mockReturnValue(mockResponse);

        const request = {
          params: {
            name: 'get_osc_messages',
            arguments: {
              endpointId: 'endpoint-1',
              addressPattern: '/synth/*',
              timeWindowSeconds: 60,
              limit: 10,
            },
          },
        };

        const result = await callToolHandler(request);

        expect(mockOSCManager.getMessages).toHaveBeenCalledWith('endpoint-1', {
          addressPattern: '/synth/*',
          since: expect.any(Date),
          limit: 10,
        });

        expect(JSON.parse(result.content[0].text)).toEqual(expectedResponse);
      });

      it('should handle query without parameters', async () => {
        const mockResponse: MessageQueryResponse = {
          messages: [],
          totalCount: 0,
          filteredCount: 0,
        };

        mockOSCManager.getMessages.mockReturnValue(mockResponse);

        const request = {
          params: {
            name: 'get_osc_messages',
            arguments: {},
          },
        };

        const result = await callToolHandler(request);

        expect(mockOSCManager.getMessages).toHaveBeenCalledWith(undefined, {});
        expect(JSON.parse(result.content[0].text)).toEqual(mockResponse);
      });
    });

    describe('get_endpoint_status', () => {
      it('should get endpoint status successfully', async () => {
        const mockEndpoints: OSCEndpointInfo[] = [
          {
            id: 'endpoint-1',
            port: 8000,
            status: 'active',
            bufferSize: 1000,
            addressFilters: [],
            createdAt: new Date('2024-01-01T12:00:00Z'),
            messageCount: 5,
          },
        ];

        const mockResponse: EndpointStatusResponse = {
          endpoints: mockEndpoints,
        };

        const expectedResponse = {
          endpoints: [
            {
              id: 'endpoint-1',
              port: 8000,
              status: 'active',
              bufferSize: 1000,
              addressFilters: [],
              createdAt: '2024-01-01T12:00:00.000Z',
              messageCount: 5,
            },
          ],
        };

        mockOSCManager.getEndpointStatus.mockReturnValue(mockResponse);

        const request = {
          params: {
            name: 'get_endpoint_status',
            arguments: { endpointId: 'endpoint-1' },
          },
        };

        const result = await callToolHandler(request);

        expect(mockOSCManager.getEndpointStatus).toHaveBeenCalledWith('endpoint-1');
        expect(JSON.parse(result.content[0].text)).toEqual(expectedResponse);
      });
    });

    describe('Error Handling', () => {
      it('should handle unknown tool names', async () => {
        const request = {
          params: {
            name: 'unknown_tool',
            arguments: {},
          },
        };

        await expect(callToolHandler(request)).rejects.toThrow();
      });

      it('should convert generic errors to MCP errors', async () => {
        mockOSCManager.createEndpoint.mockRejectedValue(new Error('Generic error'));

        const request = {
          params: {
            name: 'create_osc_endpoint',
            arguments: { port: 8000 },
          },
        };

        await expect(callToolHandler(request)).rejects.toThrow();
      });

      describe('Parameter Validation Errors', () => {
        it('should validate create_osc_endpoint parameters', async () => {
          const invalidRequests = [
            // Missing port
            { arguments: {} },
            // Invalid port type
            { arguments: { port: 'invalid' } },
            // Port out of range
            { arguments: { port: 100 } },
            // Invalid buffer size
            { arguments: { port: 8000, bufferSize: 'invalid' } },
            // Invalid address filters
            { arguments: { port: 8000, addressFilters: 'invalid' } },
            // Invalid address pattern in filters
            { arguments: { port: 8000, addressFilters: ['invalid'] } },
          ];

          for (const args of invalidRequests) {
            const request = {
              params: {
                name: 'create_osc_endpoint',
                arguments: args.arguments,
              },
            };

            await expect(callToolHandler(request)).rejects.toThrow();
          }
        });

        it('should validate stop_osc_endpoint parameters', async () => {
          const invalidRequests = [
            // Missing endpoint ID
            { arguments: {} },
            // Invalid endpoint ID type
            { arguments: { endpointId: 123 } },
            // Empty endpoint ID
            { arguments: { endpointId: '' } },
          ];

          for (const args of invalidRequests) {
            const request = {
              params: {
                name: 'stop_osc_endpoint',
                arguments: args.arguments,
              },
            };

            await expect(callToolHandler(request)).rejects.toThrow();
          }
        });

        it('should validate get_osc_messages parameters', async () => {
          const invalidRequests = [
            // Invalid endpoint ID type
            { arguments: { endpointId: 123 } },
            // Invalid address pattern
            { arguments: { addressPattern: 'invalid' } },
            // Invalid time window
            { arguments: { timeWindowSeconds: 'invalid' } },
            // Time window out of range
            { arguments: { timeWindowSeconds: 100000 } },
            // Invalid limit
            { arguments: { limit: 'invalid' } },
            // Limit out of range
            { arguments: { limit: 2000 } },
          ];

          for (const args of invalidRequests) {
            const request = {
              params: {
                name: 'get_osc_messages',
                arguments: args.arguments,
              },
            };

            await expect(callToolHandler(request)).rejects.toThrow();
          }
        });

        it('should validate get_endpoint_status parameters', async () => {
          const request = {
            params: {
              name: 'get_endpoint_status',
              arguments: { endpointId: 123 }, // Invalid type
            },
          };

          await expect(callToolHandler(request)).rejects.toThrow();
        });
      });

      describe('Network Error Handling', () => {
        it('should handle port in use errors', async () => {
          const mockResponse: CreateEndpointResponse = {
            endpointId: '',
            port: 8000,
            status: 'error',
            message: 'Port 8000 is already in use. Please try a different port.',
          };

          mockOSCManager.createEndpoint.mockResolvedValue(mockResponse);

          const request = {
            params: {
              name: 'create_osc_endpoint',
              arguments: { port: 8000 },
            },
          };

          await expect(callToolHandler(request)).rejects.toThrow();
        });

        it('should handle permission denied errors', async () => {
          const mockResponse: CreateEndpointResponse = {
            endpointId: '',
            port: 80,
            status: 'error',
            message:
              'Permission denied to bind to port 80. Try using a port number above 1024 or run with appropriate privileges.',
          };

          mockOSCManager.createEndpoint.mockResolvedValue(mockResponse);

          const request = {
            params: {
              name: 'create_osc_endpoint',
              arguments: { port: 80 },
            },
          };

          await expect(callToolHandler(request)).rejects.toThrow();
        });
      });

      describe('Endpoint Error Handling', () => {
        it('should handle endpoint not found errors', async () => {
          const mockResponse: StopEndpointResponse = {
            endpointId: 'nonexistent',
            message:
              "Endpoint 'nonexistent' not found. Please check the endpoint ID and try again.",
          };

          mockOSCManager.stopEndpoint.mockResolvedValue(mockResponse);

          const request = {
            params: {
              name: 'stop_osc_endpoint',
              arguments: { endpointId: 'nonexistent' },
            },
          };

          const result = await callToolHandler(request);
          expect(JSON.parse(result.content[0].text)).toEqual(mockResponse);
        });
      });

      describe('Operation Error Handling', () => {
        it('should handle operation failures gracefully', async () => {
          mockOSCManager.createEndpoint.mockRejectedValue(new Error('Unexpected error'));

          const request = {
            params: {
              name: 'create_osc_endpoint',
              arguments: { port: 8000 },
            },
          };

          await expect(callToolHandler(request)).rejects.toThrow();
        });

        it('should handle OSC manager errors in get_messages', async () => {
          mockOSCManager.getMessages.mockImplementation(() => {
            throw new Error('Buffer error');
          });

          const request = {
            params: {
              name: 'get_osc_messages',
              arguments: {},
            },
          };

          await expect(callToolHandler(request)).rejects.toThrow();
        });

        it('should handle OSC manager errors in get_endpoint_status', async () => {
          mockOSCManager.getEndpointStatus.mockImplementation(() => {
            throw new Error('Status error');
          });

          const request = {
            params: {
              name: 'get_endpoint_status',
              arguments: {},
            },
          };

          await expect(callToolHandler(request)).rejects.toThrow();
        });
      });
    });
  });

  describe('VSCode Compatibility', () => {
    it('should use stdio transport for VSCode integration', async () => {
      const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

      await server.start();

      expect(StdioServerTransport).toHaveBeenCalled();
      expect(mockMCPServer.connect).toHaveBeenCalledWith(mockTransport);
    });

    it('should provide MCP-compliant tool schemas', async () => {
      const calls = mockMCPServer.setRequestHandler.mock.calls;
      const listToolsCall = calls.find((call: any) => call[0].method === 'tools/list');
      const listToolsHandler = listToolsCall[1];

      const result = await listToolsHandler();

      // Verify all tools have required MCP schema properties
      result.tools.forEach((tool: any) => {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
      });
    });

    it('should handle connection lifecycle gracefully', async () => {
      // Test multiple start/stop cycles
      await server.start();
      expect(server.isServerRunning()).toBe(true);

      await server.shutdown();
      expect(server.isServerRunning()).toBe(false);

      // Should be able to start again
      await server.start();
      expect(server.isServerRunning()).toBe(true);
    });
  });

  describe('Event Handling', () => {
    it('should set up OSC manager event listeners', () => {
      expect(mockOSCManager.on).toHaveBeenCalledWith('endpointCreated', expect.any(Function));
      expect(mockOSCManager.on).toHaveBeenCalledWith('endpointStopped', expect.any(Function));
      expect(mockOSCManager.on).toHaveBeenCalledWith('endpointError', expect.any(Function));
      expect(mockOSCManager.on).toHaveBeenCalledWith('messageReceived', expect.any(Function));
    });
  });

  describe('Utility Methods', () => {
    it('should provide access to OSC manager for testing', () => {
      const oscManager = server.getOSCManager();
      expect(oscManager).toBe(mockOSCManager);
    });

    it('should track running status correctly', async () => {
      expect(server.isServerRunning()).toBe(false);

      await server.start();
      expect(server.isServerRunning()).toBe(true);

      await server.shutdown();
      expect(server.isServerRunning()).toBe(false);
    });
  });
});
