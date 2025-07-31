/**
 * Integration tests with real OSC communication
 *
 * Tests the complete OSC MCP server functionality with actual OSC message
 * transmission, multiple concurrent endpoints, resource cleanup, and memory management.
 */

import { createSocket, Socket } from 'dgram';
import { OSCMCPServer } from '../server';
import { OSCManager, createOSCManager } from './manager';
import { OSCMessage, OSCEndpointConfig } from '../types/index';

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

/**
 * Helper class to create and send OSC messages for testing
 */
class OSCTestSender {
  private socket: Socket;

  constructor() {
    this.socket = createSocket('udp4');
  }

  /**
   * Creates a basic OSC message buffer
   */
  private createOSCMessage(address: string, typeTags: string, ...args: any[]): Buffer {
    const addressBuffer = Buffer.from(address + '\0');
    const addressPadded = this.padToMultipleOf4(addressBuffer);

    const typeTagsBuffer = Buffer.from(',' + typeTags + '\0');
    const typeTagsPadded = this.padToMultipleOf4(typeTagsBuffer);

    const argBuffers: Buffer[] = [];

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const typeTag = typeTags[i];

      switch (typeTag) {
        case 'i': // int32
          const intBuffer = Buffer.allocUnsafe(4);
          intBuffer.writeInt32BE(arg, 0);
          argBuffers.push(intBuffer);
          break;

        case 'f': // float32
          const floatBuffer = Buffer.allocUnsafe(4);
          floatBuffer.writeFloatBE(arg, 0);
          argBuffers.push(floatBuffer);
          break;

        case 's': // string
          const stringBuffer = Buffer.from(arg + '\0');
          argBuffers.push(this.padToMultipleOf4(stringBuffer));
          break;

        case 'b': // blob
          const blobSize = Buffer.allocUnsafe(4);
          blobSize.writeInt32BE(arg.length, 0);
          const blobData = this.padToMultipleOf4(arg);
          argBuffers.push(Buffer.concat([blobSize, blobData]));
          break;
      }
    }

    return Buffer.concat([addressPadded, typeTagsPadded, ...argBuffers]);
  }

  /**
   * Pads buffer to multiple of 4 bytes (OSC requirement)
   */
  private padToMultipleOf4(buffer: Buffer): Buffer {
    const remainder = buffer.length % 4;
    if (remainder === 0) return buffer;

    const padding = Buffer.alloc(4 - remainder);
    return Buffer.concat([buffer, padding]);
  }

  /**
   * Sends an OSC message to the specified port
   */
  async sendMessage(
    port: number,
    address: string,
    typeTags: string,
    ...args: any[]
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const message = this.createOSCMessage(address, typeTags, ...args);

      this.socket.send(message, port, 'localhost', error => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Sends multiple OSC messages in sequence
   */
  async sendMessages(
    port: number,
    messages: Array<{ address: string; typeTags: string; args: any[] }>
  ): Promise<void> {
    for (const msg of messages) {
      await this.sendMessage(port, msg.address, msg.typeTags, ...msg.args);
      // Small delay between messages to ensure proper ordering
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Sends messages rapidly for stress testing
   */
  async sendRapidMessages(
    port: number,
    count: number,
    baseAddress: string = '/test'
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    for (let i = 0; i < count; i++) {
      const address = `${baseAddress}/${i}`;
      const promise = this.sendMessage(port, address, 'if', i, i * 0.1);
      promises.push(promise);
    }

    await Promise.all(promises);
  }

  /**
   * Closes the sender socket
   */
  close(): void {
    this.socket.close();
  }
}

describe('OSC Integration Tests with Real Communication', () => {
  let server: OSCMCPServer;
  let oscManager: OSCManager;
  let mockMCPServer: any;
  let mockTransport: any;
  let callToolHandler: any;
  let testSender: OSCTestSender;

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
    oscManager = server.getOSCManager();

    // Extract the call tool handler
    const calls = mockMCPServer.setRequestHandler.mock.calls;
    const callToolCall = calls.find((call: any) => call[0].method === 'tools/call');
    callToolHandler = callToolCall[1];

    // Create test sender
    testSender = new OSCTestSender();
  });

  afterEach(async () => {
    // Clean up resources
    testSender.close();

    try {
      await oscManager.shutdown();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Real OSC Message Communication', () => {
    it('should receive and parse actual OSC messages', async () => {
      // Create endpoint
      const createRequest = {
        params: {
          name: 'create_osc_endpoint',
          arguments: { port: 9001, bufferSize: 100 },
        },
      };

      const createResult = await callToolHandler(createRequest);
      const createResponse = JSON.parse(createResult.content[0].text);
      expect(createResponse.status).toBe('active');

      const endpointId = createResponse.endpointId;

      // Wait for endpoint to be fully ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Send test messages
      await testSender.sendMessage(9001, '/synth/freq', 'f', 440.0);
      await testSender.sendMessage(9001, '/synth/amp', 'f', 0.8);
      await testSender.sendMessage(9001, '/drum/kick', 'i', 1);

      // Wait for messages to be processed
      await new Promise(resolve => setTimeout(resolve, 200));

      // Query messages
      const queryRequest = {
        params: {
          name: 'get_osc_messages',
          arguments: { endpointId },
        },
      };

      const queryResult = await callToolHandler(queryRequest);
      const queryResponse = JSON.parse(queryResult.content[0].text);

      expect(queryResponse.messages).toHaveLength(3);
      expect(queryResponse.totalCount).toBe(3);
      expect(queryResponse.filteredCount).toBe(3);

      // Verify message content
      const messages = queryResponse.messages;
      expect(
        messages.some(
          (m: OSCMessage) =>
            m.address === '/synth/freq' && Math.abs((m.arguments[0] as number) - 440) < 0.001
        )
      ).toBe(true);
      expect(
        messages.some(
          (m: OSCMessage) =>
            m.address === '/synth/amp' && Math.abs((m.arguments[0] as number) - 0.8) < 0.001
        )
      ).toBe(true);
      expect(
        messages.some((m: OSCMessage) => m.address === '/drum/kick' && m.arguments[0] === 1)
      ).toBe(true);
    });

    it('should handle different OSC data types correctly', async () => {
      // Create endpoint
      const createRequest = {
        params: {
          name: 'create_osc_endpoint',
          arguments: { port: 9002 },
        },
      };

      const createResult = await callToolHandler(createRequest);
      const createResponse = JSON.parse(createResult.content[0].text);
      const endpointId = createResponse.endpointId;

      await new Promise(resolve => setTimeout(resolve, 100));

      // Send messages with different data types
      await testSender.sendMessage(9002, '/test/int', 'i', 42);
      await testSender.sendMessage(9002, '/test/float', 'f', 3.14159);
      await testSender.sendMessage(9002, '/test/string', 's', 'hello world');
      await testSender.sendMessage(9002, '/test/mixed', 'ifs', 123, 4.56, 'test');

      await new Promise(resolve => setTimeout(resolve, 200));

      // Query and verify messages
      const queryRequest = {
        params: {
          name: 'get_osc_messages',
          arguments: { endpointId },
        },
      };

      const queryResult = await callToolHandler(queryRequest);
      const queryResponse = JSON.parse(queryResult.content[0].text);

      expect(queryResponse.messages).toHaveLength(4);

      const messages = queryResponse.messages;

      // Find and verify each message type
      const intMsg = messages.find((m: OSCMessage) => m.address === '/test/int');
      expect(intMsg).toBeDefined();
      expect(intMsg.typeTags).toBe('i');
      expect(intMsg.arguments[0]).toBe(42);

      const floatMsg = messages.find((m: OSCMessage) => m.address === '/test/float');
      expect(floatMsg).toBeDefined();
      expect(floatMsg.typeTags).toBe('f');
      expect(floatMsg.arguments[0]).toBeCloseTo(3.14159, 5);

      const stringMsg = messages.find((m: OSCMessage) => m.address === '/test/string');
      expect(stringMsg).toBeDefined();
      expect(stringMsg.typeTags).toBe('s');
      expect(stringMsg.arguments[0]).toBe('hello world');

      const mixedMsg = messages.find((m: OSCMessage) => m.address === '/test/mixed');
      expect(mixedMsg).toBeDefined();
      expect(mixedMsg.typeTags).toBe('ifs');
      expect(mixedMsg.arguments).toEqual([123, expect.closeTo(4.56, 2), 'test']);
    });

    it('should filter messages by address pattern', async () => {
      // Create endpoint with address filters
      const createRequest = {
        params: {
          name: 'create_osc_endpoint',
          arguments: {
            port: 9003,
            addressFilters: ['/synth/*', '/drum/kick'],
          },
        },
      };

      const createResult = await callToolHandler(createRequest);
      const createResponse = JSON.parse(createResult.content[0].text);
      const endpointId = createResponse.endpointId;

      await new Promise(resolve => setTimeout(resolve, 100));

      // Send various messages
      await testSender.sendMessage(9003, '/synth/freq', 'f', 440.0);
      await testSender.sendMessage(9003, '/synth/amp', 'f', 0.8);
      await testSender.sendMessage(9003, '/drum/kick', 'i', 1);
      await testSender.sendMessage(9003, '/drum/snare', 'i', 1); // Should be filtered out
      await testSender.sendMessage(9003, '/fx/reverb', 'f', 0.3); // Should be filtered out

      await new Promise(resolve => setTimeout(resolve, 200));

      // Query messages
      const queryRequest = {
        params: {
          name: 'get_osc_messages',
          arguments: { endpointId },
        },
      };

      const queryResult = await callToolHandler(queryRequest);
      const queryResponse = JSON.parse(queryResult.content[0].text);

      // Should only have messages matching the filters
      expect(queryResponse.messages).toHaveLength(3);

      const addresses = queryResponse.messages.map((m: OSCMessage) => m.address);
      expect(addresses).toContain('/synth/freq');
      expect(addresses).toContain('/synth/amp');
      expect(addresses).toContain('/drum/kick');
      expect(addresses).not.toContain('/drum/snare');
      expect(addresses).not.toContain('/fx/reverb');
    });
  });

  describe('Multiple Concurrent Endpoints', () => {
    it('should handle multiple endpoints receiving messages simultaneously', async () => {
      // Create multiple endpoints
      const endpoints = [];
      const ports = [9010, 9011, 9012];

      for (const port of ports) {
        const createRequest = {
          params: {
            name: 'create_osc_endpoint',
            arguments: { port, bufferSize: 50 },
          },
        };

        const createResult = await callToolHandler(createRequest);
        const createResponse = JSON.parse(createResult.content[0].text);
        expect(createResponse.status).toBe('active');
        endpoints.push(createResponse.endpointId);
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // Send different messages to each endpoint
      await testSender.sendMessage(9010, '/endpoint1/test', 'i', 1);
      await testSender.sendMessage(9011, '/endpoint2/test', 'i', 2);
      await testSender.sendMessage(9012, '/endpoint3/test', 'i', 3);

      // Send some messages to multiple endpoints
      await testSender.sendMessage(9010, '/shared/msg', 's', 'port1');
      await testSender.sendMessage(9011, '/shared/msg', 's', 'port2');

      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify each endpoint received its messages
      for (let i = 0; i < endpoints.length; i++) {
        const queryRequest = {
          params: {
            name: 'get_osc_messages',
            arguments: { endpointId: endpoints[i] },
          },
        };

        const queryResult = await callToolHandler(queryRequest);
        const queryResponse = JSON.parse(queryResult.content[0].text);

        expect(queryResponse.messages.length).toBeGreaterThan(0);

        // Each endpoint should have received at least one message
        const hasEndpointSpecificMessage = queryResponse.messages.some(
          (m: OSCMessage) => m.address === `/endpoint${i + 1}/test`
        );
        expect(hasEndpointSpecificMessage).toBe(true);
      }

      // Query all endpoints together
      const allQueryRequest = {
        params: {
          name: 'get_osc_messages',
          arguments: {},
        },
      };

      const allQueryResult = await callToolHandler(allQueryRequest);
      const allQueryResponse = JSON.parse(allQueryResult.content[0].text);

      expect(allQueryResponse.messages.length).toBe(5); // Total messages sent
      expect(allQueryResponse.totalCount).toBe(5);
    });

    it('should handle concurrent message sending to same endpoint', async () => {
      // Create endpoint
      const createRequest = {
        params: {
          name: 'create_osc_endpoint',
          arguments: { port: 9020, bufferSize: 200 },
        },
      };

      const createResult = await callToolHandler(createRequest);
      const createResponse = JSON.parse(createResult.content[0].text);
      const endpointId = createResponse.endpointId;

      await new Promise(resolve => setTimeout(resolve, 100));

      // Send many messages rapidly
      const messageCount = 50;
      await testSender.sendRapidMessages(9020, messageCount, '/rapid');

      // Wait for all messages to be processed
      await new Promise(resolve => setTimeout(resolve, 500));

      // Query messages
      const queryRequest = {
        params: {
          name: 'get_osc_messages',
          arguments: { endpointId },
        },
      };

      const queryResult = await callToolHandler(queryRequest);
      const queryResponse = JSON.parse(queryResult.content[0].text);

      // Should have received all messages
      expect(queryResponse.messages.length).toBe(messageCount);
      expect(queryResponse.totalCount).toBe(messageCount);

      // Verify message content and ordering
      const addresses = queryResponse.messages.map((m: OSCMessage) => m.address);
      for (let i = 0; i < messageCount; i++) {
        expect(addresses).toContain(`/rapid/${i}`);
      }
    });
  });

  describe('MCP Tool Execution with Real OSC Data Flow', () => {
    it('should demonstrate complete MCP workflow with real OSC messages', async () => {
      // Step 1: Create endpoint via MCP tool
      const createRequest = {
        params: {
          name: 'create_osc_endpoint',
          arguments: { port: 9030, bufferSize: 100 },
        },
      };

      const createResult = await callToolHandler(createRequest);
      const createResponse = JSON.parse(createResult.content[0].text);
      expect(createResponse.status).toBe('active');
      const endpointId = createResponse.endpointId;

      // Step 2: Check endpoint status via MCP tool
      const statusRequest = {
        params: {
          name: 'get_endpoint_status',
          arguments: { endpointId },
        },
      };

      const statusResult = await callToolHandler(statusRequest);
      const statusResponse = JSON.parse(statusResult.content[0].text);
      expect(statusResponse.endpoints).toHaveLength(1);
      expect(statusResponse.endpoints[0].status).toBe('active');
      expect(statusResponse.endpoints[0].messageCount).toBe(0);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Step 3: Send real OSC messages
      await testSender.sendMessage(9030, '/workflow/step1', 'i', 1);
      await testSender.sendMessage(9030, '/workflow/step2', 'f', 2.5);
      await testSender.sendMessage(9030, '/workflow/step3', 's', 'complete');

      await new Promise(resolve => setTimeout(resolve, 200));

      // Step 4: Query messages via MCP tool
      const queryRequest = {
        params: {
          name: 'get_osc_messages',
          arguments: { endpointId, limit: 10 },
        },
      };

      const queryResult = await callToolHandler(queryRequest);
      const queryResponse = JSON.parse(queryResult.content[0].text);

      expect(queryResponse.messages).toHaveLength(3);
      expect(queryResponse.totalCount).toBe(3);

      // Step 5: Query with filters via MCP tool
      const filteredQueryRequest = {
        params: {
          name: 'get_osc_messages',
          arguments: {
            endpointId,
            addressPattern: '/workflow/step*',
            limit: 5,
          },
        },
      };

      const filteredQueryResult = await callToolHandler(filteredQueryRequest);
      const filteredQueryResponse = JSON.parse(filteredQueryResult.content[0].text);

      expect(filteredQueryResponse.messages).toHaveLength(3);

      // Step 6: Check updated endpoint status
      const finalStatusResult = await callToolHandler(statusRequest);
      const finalStatusResponse = JSON.parse(finalStatusResult.content[0].text);
      expect(finalStatusResponse.endpoints[0].messageCount).toBe(3);

      // Step 7: Stop endpoint via MCP tool
      const stopRequest = {
        params: {
          name: 'stop_osc_endpoint',
          arguments: { endpointId },
        },
      };

      const stopResult = await callToolHandler(stopRequest);
      const stopResponse = JSON.parse(stopResult.content[0].text);
      expect(stopResponse.message).toContain('stopped successfully');

      // Step 8: Verify endpoint is stopped
      const finalStatusCheck = await callToolHandler(statusRequest);
      const finalStatusCheckResponse = JSON.parse(finalStatusCheck.content[0].text);
      expect(finalStatusCheckResponse.endpoints).toHaveLength(0);
    });

    it('should handle time-based message queries with real data', async () => {
      // Create endpoint
      const createRequest = {
        params: {
          name: 'create_osc_endpoint',
          arguments: { port: 9031 },
        },
      };

      const createResult = await callToolHandler(createRequest);
      const createResponse = JSON.parse(createResult.content[0].text);
      const endpointId = createResponse.endpointId;

      await new Promise(resolve => setTimeout(resolve, 100));

      // Send first batch of messages
      await testSender.sendMessage(9031, '/time/batch1', 'i', 1);
      await testSender.sendMessage(9031, '/time/batch1', 'i', 2);

      // Wait 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Send second batch of messages
      await testSender.sendMessage(9031, '/time/batch2', 'i', 3);
      await testSender.sendMessage(9031, '/time/batch2', 'i', 4);

      await new Promise(resolve => setTimeout(resolve, 200));

      // Query recent messages (last 2 seconds)
      const recentQueryRequest = {
        params: {
          name: 'get_osc_messages',
          arguments: {
            endpointId,
            timeWindowSeconds: 2,
          },
        },
      };

      const recentQueryResult = await callToolHandler(recentQueryRequest);
      const recentQueryResponse = JSON.parse(recentQueryResult.content[0].text);

      expect(recentQueryResponse.messages).toHaveLength(4);

      // Query very recent messages (last 1 second)
      const veryRecentQueryRequest = {
        params: {
          name: 'get_osc_messages',
          arguments: {
            endpointId,
            timeWindowSeconds: 1,
          },
        },
      };

      const veryRecentQueryResult = await callToolHandler(veryRecentQueryRequest);
      const veryRecentQueryResponse = JSON.parse(veryRecentQueryResult.content[0].text);

      // Should only have the second batch (messages from the last 1 second)
      expect(veryRecentQueryResponse.messages.length).toBeLessThanOrEqual(4);

      // All recent messages should be from batch2
      const recentAddresses = veryRecentQueryResponse.messages.map((m: OSCMessage) => m.address);
      recentAddresses.forEach((addr: string) => {
        expect(addr).toBe('/time/batch2');
      });
    });
  });

  describe('Resource Cleanup and Memory Management', () => {
    it('should properly clean up resources when endpoints are stopped', async () => {
      // Create multiple endpoints
      const endpointIds: string[] = [];
      const ports = [9040, 9041, 9042];

      for (const port of ports) {
        const createRequest = {
          params: {
            name: 'create_osc_endpoint',
            arguments: { port, bufferSize: 50 },
          },
        };

        const createResult = await callToolHandler(createRequest);
        const createResponse = JSON.parse(createResult.content[0].text);
        endpointIds.push(createResponse.endpointId);
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // Send messages to each endpoint
      for (let i = 0; i < ports.length; i++) {
        await testSender.sendMessage(ports[i]!, `/cleanup/test${i}`, 'i', i);
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify all endpoints are active and have messages
      const allStatusRequest = {
        params: {
          name: 'get_endpoint_status',
          arguments: {},
        },
      };

      const allStatusResult = await callToolHandler(allStatusRequest);
      const allStatusResponse = JSON.parse(allStatusResult.content[0].text);
      expect(allStatusResponse.endpoints).toHaveLength(3);

      // Stop endpoints one by one and verify cleanup
      for (let i = 0; i < endpointIds.length; i++) {
        const stopRequest = {
          params: {
            name: 'stop_osc_endpoint',
            arguments: { endpointId: endpointIds[i] },
          },
        };

        const stopResult = await callToolHandler(stopRequest);
        const stopResponse = JSON.parse(stopResult.content[0].text);
        expect(stopResponse.message).toContain('stopped successfully');

        // Verify endpoint count decreases
        const statusResult = await callToolHandler(allStatusRequest);
        const statusResponse = JSON.parse(statusResult.content[0].text);
        expect(statusResponse.endpoints).toHaveLength(2 - i);
      }

      // Verify all endpoints are cleaned up
      const finalStatusResult = await callToolHandler(allStatusRequest);
      const finalStatusResponse = JSON.parse(finalStatusResult.content[0].text);
      expect(finalStatusResponse.endpoints).toHaveLength(0);

      // Verify ports are available for reuse
      const reuseRequest = {
        params: {
          name: 'create_osc_endpoint',
          arguments: { port: 9040 },
        },
      };

      const reuseResult = await callToolHandler(reuseRequest);
      const reuseResponse = JSON.parse(reuseResult.content[0].text);
      expect(reuseResponse.status).toBe('active');
    });

    it('should handle message buffer overflow correctly', async () => {
      // Create endpoint with small buffer
      const createRequest = {
        params: {
          name: 'create_osc_endpoint',
          arguments: { port: 9050, bufferSize: 10 },
        },
      };

      const createResult = await callToolHandler(createRequest);
      const createResponse = JSON.parse(createResult.content[0].text);
      const endpointId = createResponse.endpointId;

      await new Promise(resolve => setTimeout(resolve, 100));

      // Send more messages than buffer can hold
      const messageCount = 20;
      for (let i = 0; i < messageCount; i++) {
        await testSender.sendMessage(9050, `/overflow/${i}`, 'i', i);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      // Query messages
      const queryRequest = {
        params: {
          name: 'get_osc_messages',
          arguments: { endpointId },
        },
      };

      const queryResult = await callToolHandler(queryRequest);
      const queryResponse = JSON.parse(queryResult.content[0].text);

      // Should only have buffer size number of messages (most recent)
      expect(queryResponse.messages.length).toBeLessThanOrEqual(10);
      expect(queryResponse.totalCount).toBe(10); // Buffer size

      // Verify we have the most recent messages
      const addresses = queryResponse.messages.map((m: OSCMessage) => m.address);

      // Should contain recent message addresses
      const hasRecentMessages = addresses.some((addr: string) => {
        const parts = addr.split('/');
        const indexStr = parts[2];
        return indexStr && parseInt(indexStr) >= messageCount - 10;
      });
      expect(hasRecentMessages).toBe(true);
    });

    it('should handle graceful shutdown of all resources', async () => {
      // Create multiple endpoints with messages
      const endpointIds: string[] = [];
      const ports = [9060, 9061, 9062];

      for (const port of ports) {
        const createRequest = {
          params: {
            name: 'create_osc_endpoint',
            arguments: { port },
          },
        };

        const createResult = await callToolHandler(createRequest);
        const createResponse = JSON.parse(createResult.content[0].text);
        endpointIds.push(createResponse.endpointId);
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // Send messages to all endpoints
      for (let i = 0; i < ports.length; i++) {
        await testSender.sendMessage(ports[i]!, `/shutdown/test${i}`, 'i', i);
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify all endpoints are active
      const statusRequest = {
        params: {
          name: 'get_endpoint_status',
          arguments: {},
        },
      };

      const statusResult = await callToolHandler(statusRequest);
      const statusResponse = JSON.parse(statusResult.content[0].text);
      expect(statusResponse.endpoints).toHaveLength(3);

      // Perform graceful shutdown
      await oscManager.shutdown();

      // Verify all endpoints are cleaned up
      const finalStatusResult = await callToolHandler(statusRequest);
      const finalStatusResponse = JSON.parse(finalStatusResult.content[0].text);
      expect(finalStatusResponse.endpoints).toHaveLength(0);

      // Verify ports are available for reuse after shutdown
      const newManager = createOSCManager();
      const config: OSCEndpointConfig = { port: 9060 };
      const createResponse = await newManager.createEndpoint(config);
      expect(createResponse.status).toBe('active');

      await newManager.shutdown();
    });

    it('should handle memory usage efficiently with large message volumes', async () => {
      // Create endpoint with reasonable buffer size
      const createRequest = {
        params: {
          name: 'create_osc_endpoint',
          arguments: { port: 9070, bufferSize: 1000 },
        },
      };

      const createResult = await callToolHandler(createRequest);
      const createResponse = JSON.parse(createResult.content[0].text);
      const endpointId = createResponse.endpointId;

      await new Promise(resolve => setTimeout(resolve, 100));

      // Send large volume of messages
      const batchSize = 100;
      const batches = 5;

      for (let batch = 0; batch < batches; batch++) {
        // Send batch of messages
        for (let i = 0; i < batchSize; i++) {
          const messageIndex = batch * batchSize + i;
          await testSender.sendMessage(
            9070,
            `/memory/test${messageIndex}`,
            'ifs',
            messageIndex,
            messageIndex * 0.1,
            `message${messageIndex}`
          );
        }

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 50));

        // Query messages periodically to verify system stability
        if (batch % 2 === 0) {
          const queryRequest = {
            params: {
              name: 'get_osc_messages',
              arguments: { endpointId, limit: 10 },
            },
          };

          const queryResult = await callToolHandler(queryRequest);
          const queryResponse = JSON.parse(queryResult.content[0].text);
          expect(queryResponse.messages.length).toBeGreaterThan(0);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      // Final verification
      const finalQueryRequest = {
        params: {
          name: 'get_osc_messages',
          arguments: { endpointId },
        },
      };

      const finalQueryResult = await callToolHandler(finalQueryRequest);
      const finalQueryResponse = JSON.parse(finalQueryResult.content[0].text);

      // Should have buffer size messages (most recent)
      expect(finalQueryResponse.messages.length).toBeLessThanOrEqual(1000);
      expect(finalQueryResponse.totalCount).toBeLessThanOrEqual(1000);

      // Verify message integrity
      const messages = finalQueryResponse.messages;
      messages.forEach((msg: OSCMessage) => {
        expect(msg.address).toMatch(/^\/memory\/test\d+$/);
        expect(msg.typeTags).toBe('ifs');
        expect(msg.arguments).toHaveLength(3);
        expect(typeof msg.arguments[0]).toBe('number');
        expect(typeof msg.arguments[1]).toBe('number');
        expect(typeof msg.arguments[2]).toBe('string');
      });
    });
  });
});
