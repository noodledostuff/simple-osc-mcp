/**
 * OSC MCP Server Implementation
 *
 * This class implements the MCP server protocol and manages OSC endpoints.
 * It provides full VSCode compatibility with stdio transport support.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { OSCManager, createOSCManager } from './osc/manager';
import {
  CreateEndpointParams,
  StopEndpointParams,
  GetMessagesParams,
  GetEndpointStatusParams,
  CreateEndpointResponse,
  StopEndpointResponse,
  MessageQueryResponse,
  EndpointStatusResponse,
  MessageQuery,
} from './types/index';
import { ParameterValidator } from './errors/validation';
import { OperationErrors } from './errors/index';

/**
 * MCP Server for OSC endpoint management with full VSCode compatibility
 */
export class OSCMCPServer {
  private server: Server;
  private oscManager: OSCManager;
  private isRunning = false;

  constructor() {
    this.server = new Server({
      name: 'osc-mcp-server',
      version: '1.0.0',
    });

    this.oscManager = createOSCManager();
    this.setupToolHandlers();
    this.setupEventHandlers();
  }

  /**
   * Starts the MCP server with stdio transport for VSCode compatibility
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Server is already running');
    }

    try {
      // Create stdio transport for VSCode integration
      const transport = new StdioServerTransport();

      // Connect server to transport
      await this.server.connect(transport);

      this.isRunning = true;
      console.error('OSC MCP Server started successfully'); // Use stderr for logging to avoid interfering with stdio transport
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to start MCP server: ${errorMessage}`);
    }
  }

  /**
   * Gracefully shuts down the server and cleans up all resources
   */
  async shutdown(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Stop all OSC endpoints first
      await this.oscManager.shutdown();

      // Close MCP server
      await this.server.close();

      console.error('OSC MCP Server shut down successfully');
    } catch (error) {
      console.error('Error during server shutdown:', error);
    } finally {
      // Always mark as not running, even if there were errors
      this.isRunning = false;
    }
  }

  /**
   * Sets up MCP tool handlers for OSC functionality
   */
  private setupToolHandlers(): void {
    // Register list tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'create_osc_endpoint',
            description: 'Create a new OSC endpoint to listen for incoming OSC messages',
            inputSchema: {
              type: 'object',
              properties: {
                port: {
                  type: 'number',
                  description: 'UDP port number to listen on (1024-65535)',
                  minimum: 1024,
                  maximum: 65535,
                },
                bufferSize: {
                  type: 'number',
                  description: 'Maximum number of messages to store in buffer (default: 1000)',
                  minimum: 1,
                  maximum: 10000,
                  default: 1000,
                },
                addressFilters: {
                  type: 'array',
                  description: 'OSC address patterns to filter messages (optional)',
                  items: {
                    type: 'string',
                  },
                },
              },
              required: ['port'],
            },
          },
          {
            name: 'stop_osc_endpoint',
            description: 'Stop and remove an existing OSC endpoint',
            inputSchema: {
              type: 'object',
              properties: {
                endpointId: {
                  type: 'string',
                  description: 'ID of the endpoint to stop',
                },
              },
              required: ['endpointId'],
            },
          },
          {
            name: 'get_osc_messages',
            description: 'Query received OSC messages from endpoints',
            inputSchema: {
              type: 'object',
              properties: {
                endpointId: {
                  type: 'string',
                  description:
                    'Optional endpoint ID to query (if not provided, queries all endpoints)',
                },
                addressPattern: {
                  type: 'string',
                  description: 'Optional OSC address pattern to filter messages',
                },
                timeWindowSeconds: {
                  type: 'number',
                  description: 'Optional time window in seconds (from now backwards)',
                  minimum: 1,
                },
                limit: {
                  type: 'number',
                  description: 'Optional maximum number of messages to return',
                  minimum: 1,
                  maximum: 1000,
                },
              },
              required: [],
            },
          },
          {
            name: 'get_endpoint_status',
            description: 'Get status information for OSC endpoints',
            inputSchema: {
              type: 'object',
              properties: {
                endpointId: {
                  type: 'string',
                  description: 'Optional endpoint ID (if not provided, returns all endpoints)',
                },
              },
              required: [],
            },
          },
        ],
      };
    });

    // Register call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async request => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'create_osc_endpoint':
            return await this.handleCreateEndpoint(args as unknown as CreateEndpointParams);

          case 'stop_osc_endpoint':
            return await this.handleStopEndpoint(args as unknown as StopEndpointParams);

          case 'get_osc_messages':
            return await this.handleGetMessages(args as unknown as GetMessagesParams);

          case 'get_endpoint_status':
            return await this.handleGetEndpointStatus(args as unknown as GetEndpointStatusParams);

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }

        // Convert other errors to MCP errors for proper VSCode display
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${errorMessage}`);
      }
    });
  }

  /**
   * Sets up event handlers for OSC manager events
   */
  private setupEventHandlers(): void {
    this.oscManager.on('endpointCreated', endpointInfo => {
      console.error(`Endpoint created: ${endpointInfo.id} on port ${endpointInfo.port}`);
    });

    this.oscManager.on('endpointStopped', endpointId => {
      console.error(`Endpoint stopped: ${endpointId}`);
    });

    this.oscManager.on('endpointError', (endpointId, error) => {
      console.error(`Endpoint error (${endpointId}):`, error);
    });

    this.oscManager.on('messageReceived', (endpointId, message) => {
      console.error(`Message received on ${endpointId}: ${message.address}`);
    });
  }

  /**
   * Handles create_osc_endpoint tool calls
   */
  private async handleCreateEndpoint(params: CreateEndpointParams) {
    // Validate parameters
    const validation = ParameterValidator.validateCreateEndpoint(params);
    if (!validation.isValid) {
      throw new McpError(
        ErrorCode.InvalidParams,
        validation.error!.message,
        validation.error!.details
      );
    }

    const config = {
      port: params.port,
      bufferSize: params.bufferSize || 1000,
      addressFilters: params.addressFilters || [],
    };

    try {
      const response: CreateEndpointResponse = await this.oscManager.createEndpoint(config);

      if (response.status === 'error') {
        throw new McpError(ErrorCode.InternalError, response.message);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }

      const oscError = OperationErrors.operationFailed(
        'create_osc_endpoint',
        error instanceof Error ? error.message : 'Unknown error'
      );

      throw new McpError(ErrorCode.InternalError, oscError.message, oscError.details);
    }
  }

  /**
   * Handles stop_osc_endpoint tool calls
   */
  private async handleStopEndpoint(params: StopEndpointParams) {
    // Validate parameters
    const validation = ParameterValidator.validateStopEndpoint(params);
    if (!validation.isValid) {
      throw new McpError(
        ErrorCode.InvalidParams,
        validation.error!.message,
        validation.error!.details
      );
    }

    try {
      const response: StopEndpointResponse = await this.oscManager.stopEndpoint(params.endpointId);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    } catch (error) {
      const oscError = OperationErrors.operationFailed(
        'stop_osc_endpoint',
        error instanceof Error ? error.message : 'Unknown error'
      );

      throw new McpError(ErrorCode.InternalError, oscError.message, oscError.details);
    }
  }

  /**
   * Handles get_osc_messages tool calls
   */
  private async handleGetMessages(params: GetMessagesParams) {
    // Validate parameters
    const validation = ParameterValidator.validateGetMessages(params);
    if (!validation.isValid) {
      throw new McpError(
        ErrorCode.InvalidParams,
        validation.error!.message,
        validation.error!.details
      );
    }

    try {
      // Build query from parameters
      const query: MessageQuery = {};

      if (params.addressPattern) {
        query.addressPattern = params.addressPattern;
      }

      if (params.timeWindowSeconds) {
        query.since = new Date(Date.now() - params.timeWindowSeconds * 1000);
      }

      if (params.limit) {
        query.limit = params.limit;
      }

      const response: MessageQueryResponse = this.oscManager.getMessages(params.endpointId, query);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, this.dateReplacer, 2),
          },
        ],
      };
    } catch (error) {
      const oscError = OperationErrors.operationFailed(
        'get_osc_messages',
        error instanceof Error ? error.message : 'Unknown error'
      );

      throw new McpError(ErrorCode.InternalError, oscError.message, oscError.details);
    }
  }

  /**
   * Handles get_endpoint_status tool calls
   */
  private async handleGetEndpointStatus(params: GetEndpointStatusParams) {
    // Validate parameters
    const validation = ParameterValidator.validateGetEndpointStatus(params);
    if (!validation.isValid) {
      throw new McpError(
        ErrorCode.InvalidParams,
        validation.error!.message,
        validation.error!.details
      );
    }

    try {
      const response: EndpointStatusResponse = this.oscManager.getEndpointStatus(params.endpointId);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, this.dateReplacer, 2),
          },
        ],
      };
    } catch (error) {
      const oscError = OperationErrors.operationFailed(
        'get_endpoint_status',
        error instanceof Error ? error.message : 'Unknown error'
      );

      throw new McpError(ErrorCode.InternalError, oscError.message, oscError.details);
    }
  }

  /**
   * Gets the current running status
   */
  isServerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Gets the OSC manager instance for testing purposes
   */
  getOSCManager(): OSCManager {
    return this.oscManager;
  }

  /**
   * JSON replacer function to handle Date serialization consistently
   */
  private dateReplacer(_key: string, value: any): any {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  }
}
