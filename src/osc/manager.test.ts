/**
 * Unit tests for OSCManager class
 */

import { OSCManager, createOSCManager } from './manager';
import { OSCEndpointConfig, ErrorCode } from '../types/index';
import { OSCEndpoint } from './endpoint';

// Mock the endpoint module
jest.mock('./endpoint');

describe('OSCManager', () => {
  let manager: OSCManager;
  let mockEndpoint: jest.Mocked<OSCEndpoint>;

  beforeEach(() => {
    // Create mock endpoint
    mockEndpoint = {
      getId: jest.fn(),
      getPort: jest.fn(),
      getStatus: jest.fn(),
      getMessageBuffer: jest.fn(),
      isActive: jest.fn(),
      startListening: jest.fn(),
      stopListening: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
      removeAllListeners: jest.fn(),
    } as any;

    // Mock the createOSCEndpoint function
    (require('./endpoint').createOSCEndpoint as jest.Mock).mockReturnValue(mockEndpoint);

    // Create manager
    manager = createOSCManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createEndpoint', () => {
    const testConfig: OSCEndpointConfig = {
      port: 8000,
      bufferSize: 100,
      addressFilters: ['/test/*'],
    };

    beforeEach(() => {
      mockEndpoint.getId.mockReturnValue('endpoint-1');
      mockEndpoint.getPort.mockReturnValue(8000);
      mockEndpoint.isActive.mockReturnValue(true);
      mockEndpoint.getStatus.mockReturnValue({
        id: 'endpoint-1',
        port: 8000,
        status: 'active',
        bufferSize: 100,
        addressFilters: ['/test/*'],
        createdAt: new Date(),
        messageCount: 0,
      });
      mockEndpoint.startListening.mockResolvedValue();
    });

    it('should create endpoint successfully', async () => {
      const endpointCreatedHandler = jest.fn();
      manager.on('endpointCreated', endpointCreatedHandler);

      const response = await manager.createEndpoint(testConfig);

      expect(response).toEqual({
        endpointId: 'endpoint-1',
        port: 8000,
        status: 'active',
        message: 'OSC endpoint created successfully on port 8000',
      });

      expect(mockEndpoint.startListening).toHaveBeenCalled();
      expect(endpointCreatedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'endpoint-1',
          port: 8000,
          status: 'active',
        })
      );
    });

    it('should set up event handlers for endpoint', async () => {
      await manager.createEndpoint(testConfig);

      expect(mockEndpoint.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockEndpoint.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockEndpoint.on).toHaveBeenCalledWith('statusChange', expect.any(Function));
    });

    it('should prevent creating endpoint on port already in use', async () => {
      // Create first endpoint
      await manager.createEndpoint(testConfig);

      // Try to create second endpoint on same port
      const response = await manager.createEndpoint(testConfig);

      expect(response).toEqual({
        endpointId: '',
        port: 8000,
        status: 'error',
        message: 'Port 8000 is already in use. Please try a different port.',
      });
    });

    it('should handle endpoint creation errors', async () => {
      mockEndpoint.startListening.mockRejectedValue(new Error('Port in use'));

      const response = await manager.createEndpoint(testConfig);

      expect(response).toEqual({
        endpointId: '',
        port: 8000,
        status: 'error',
        message: "Operation 'createEndpoint' failed: Port in use",
      });
    });

    it('should generate unique endpoint IDs', async () => {
      const config1: OSCEndpointConfig = { port: 8001 };
      const config2: OSCEndpointConfig = { port: 8002 };

      mockEndpoint.getId.mockReturnValueOnce('endpoint-1').mockReturnValueOnce('endpoint-2');
      mockEndpoint.getPort.mockReturnValueOnce(8001).mockReturnValueOnce(8002);

      const response1 = await manager.createEndpoint(config1);
      const response2 = await manager.createEndpoint(config2);

      expect(response1.endpointId).toBe('endpoint-1');
      expect(response2.endpointId).toBe('endpoint-2');
    });
  });

  describe('stopEndpoint', () => {
    beforeEach(async () => {
      mockEndpoint.getId.mockReturnValue('endpoint-1');
      mockEndpoint.getPort.mockReturnValue(8000);
      mockEndpoint.isActive.mockReturnValue(true);
      mockEndpoint.getStatus.mockReturnValue({
        id: 'endpoint-1',
        port: 8000,
        status: 'active',
        bufferSize: 100,
        addressFilters: [],
        createdAt: new Date(),
        messageCount: 0,
      });
      mockEndpoint.startListening.mockResolvedValue();
      mockEndpoint.stopListening.mockResolvedValue();

      await manager.createEndpoint({ port: 8000 });
    });

    it('should stop endpoint successfully', async () => {
      const endpointStoppedHandler = jest.fn();
      manager.on('endpointStopped', endpointStoppedHandler);

      const response = await manager.stopEndpoint('endpoint-1');

      expect(response).toEqual({
        endpointId: 'endpoint-1',
        message: 'Endpoint endpoint-1 stopped successfully',
      });

      expect(mockEndpoint.stopListening).toHaveBeenCalled();
      expect(endpointStoppedHandler).toHaveBeenCalledWith('endpoint-1');
    });

    it('should handle stopping non-existent endpoint', async () => {
      const response = await manager.stopEndpoint('non-existent');

      expect(response).toEqual({
        endpointId: 'non-existent',
        message: "Endpoint 'non-existent' not found. Please check the endpoint ID and try again.",
      });
    });

    it('should handle errors during endpoint stop', async () => {
      mockEndpoint.stopListening.mockRejectedValue(new Error('Stop failed'));

      const response = await manager.stopEndpoint('endpoint-1');

      expect(response).toEqual({
        endpointId: 'endpoint-1',
        message: "Operation 'stopEndpoint' failed: Stop failed",
      });
    });

    it('should remove endpoint from registry after stopping', async () => {
      await manager.stopEndpoint('endpoint-1');

      const status = manager.getEndpointStatus('endpoint-1');
      expect(status.endpoints).toHaveLength(0);
    });
  });

  describe('getEndpointStatus', () => {
    beforeEach(async () => {
      mockEndpoint.getId.mockReturnValue('endpoint-1');
      mockEndpoint.getPort.mockReturnValue(8000);
      mockEndpoint.isActive.mockReturnValue(true);
      mockEndpoint.getStatus.mockReturnValue({
        id: 'endpoint-1',
        port: 8000,
        status: 'active',
        bufferSize: 100,
        addressFilters: [],
        createdAt: new Date(),
        messageCount: 0,
      });
      mockEndpoint.startListening.mockResolvedValue();

      await manager.createEndpoint({ port: 8000 });
    });

    it('should return status for specific endpoint', () => {
      const response = manager.getEndpointStatus('endpoint-1');

      expect(response.endpoints).toHaveLength(1);
      expect(response.endpoints[0]).toEqual(
        expect.objectContaining({
          id: 'endpoint-1',
          port: 8000,
          status: 'active',
        })
      );
    });

    it('should return empty array for non-existent endpoint', () => {
      const response = manager.getEndpointStatus('non-existent');

      expect(response.endpoints).toHaveLength(0);
    });

    it('should return all endpoints when no ID specified', () => {
      const response = manager.getEndpointStatus();

      expect(response.endpoints).toHaveLength(1);
      expect(response.endpoints[0]?.id).toBe('endpoint-1');
    });
  });

  describe('getMessages', () => {
    let mockBuffer: any;

    beforeEach(async () => {
      mockBuffer = {
        getMessages: jest.fn(),
        getMessageCount: jest.fn(),
      };

      mockEndpoint.getId.mockReturnValue('endpoint-1');
      mockEndpoint.getPort.mockReturnValue(8000);
      mockEndpoint.isActive.mockReturnValue(true);
      mockEndpoint.getStatus.mockReturnValue({
        id: 'endpoint-1',
        port: 8000,
        status: 'active',
        bufferSize: 100,
        addressFilters: [],
        createdAt: new Date(),
        messageCount: 0,
      });
      mockEndpoint.getMessageBuffer.mockReturnValue(mockBuffer);
      mockEndpoint.startListening.mockResolvedValue();

      await manager.createEndpoint({ port: 8000 });
    });

    it('should get messages from specific endpoint', () => {
      const testMessages = [
        {
          timestamp: new Date(),
          address: '/test',
          typeTags: 'f',
          arguments: [440.0],
          sourceIp: '192.168.1.100',
          sourcePort: 57120,
        },
      ];

      mockBuffer.getMessages.mockReturnValue(testMessages);
      mockBuffer.getMessageCount.mockReturnValue(1);

      const response = manager.getMessages('endpoint-1');

      expect(response).toEqual({
        messages: testMessages,
        totalCount: 1,
        filteredCount: 1,
      });

      expect(mockBuffer.getMessages).toHaveBeenCalledWith({});
    });

    it('should get messages from all endpoints', () => {
      const testMessages = [
        {
          timestamp: new Date(),
          address: '/test',
          typeTags: 'f',
          arguments: [440.0],
          sourceIp: '192.168.1.100',
          sourcePort: 57120,
        },
      ];

      mockBuffer.getMessages.mockReturnValue(testMessages);
      mockBuffer.getMessageCount.mockReturnValue(1);

      const response = manager.getMessages();

      expect(response).toEqual({
        messages: testMessages,
        totalCount: 1,
        filteredCount: 1,
      });
    });

    it('should pass query parameters to buffer', () => {
      const query = { addressPattern: '/synth/*', limit: 10 };
      mockBuffer.getMessages.mockReturnValue([]);
      mockBuffer.getMessageCount.mockReturnValue(0);

      manager.getMessages('endpoint-1', query);

      expect(mockBuffer.getMessages).toHaveBeenCalledWith(query);
    });

    it('should handle non-existent endpoint', () => {
      const response = manager.getMessages('non-existent');

      expect(response).toEqual({
        messages: [],
        totalCount: 0,
        filteredCount: 0,
      });
    });
  });

  describe('getRecentMessages', () => {
    let mockBuffer: any;

    beforeEach(async () => {
      mockBuffer = {
        getMessages: jest.fn(),
        getMessageCount: jest.fn(),
      };

      mockEndpoint.getId.mockReturnValue('endpoint-1');
      mockEndpoint.getPort.mockReturnValue(8000);
      mockEndpoint.isActive.mockReturnValue(true);
      mockEndpoint.getStatus.mockReturnValue({
        id: 'endpoint-1',
        port: 8000,
        status: 'active',
        bufferSize: 100,
        addressFilters: [],
        createdAt: new Date(),
        messageCount: 0,
      });
      mockEndpoint.getMessageBuffer.mockReturnValue(mockBuffer);
      mockEndpoint.startListening.mockResolvedValue();

      await manager.createEndpoint({ port: 8000 });
    });

    it('should get recent messages with time window', () => {
      const testMessages = [
        {
          timestamp: new Date(),
          address: '/test',
          typeTags: 'f',
          arguments: [440.0],
          sourceIp: '192.168.1.100',
          sourcePort: 57120,
        },
      ];

      mockBuffer.getMessages.mockReturnValue(testMessages);
      mockBuffer.getMessageCount.mockReturnValue(1);

      const messages = manager.getRecentMessages(60, 'endpoint-1', 10);

      expect(messages).toEqual(testMessages);
      expect(mockBuffer.getMessages).toHaveBeenCalledWith(
        expect.objectContaining({
          since: expect.any(Date),
          limit: 10,
        })
      );
    });
  });

  describe('shutdown', () => {
    beforeEach(async () => {
      mockEndpoint.getId.mockReturnValue('endpoint-1');
      mockEndpoint.getPort.mockReturnValue(8000);
      mockEndpoint.isActive.mockReturnValue(true);
      mockEndpoint.getStatus.mockReturnValue({
        id: 'endpoint-1',
        port: 8000,
        status: 'active',
        bufferSize: 100,
        addressFilters: [],
        createdAt: new Date(),
        messageCount: 0,
      });
      mockEndpoint.startListening.mockResolvedValue();
      mockEndpoint.stopListening.mockResolvedValue();

      await manager.createEndpoint({ port: 8000 });
    });

    it('should stop all endpoints', async () => {
      await manager.shutdown();

      expect(mockEndpoint.stopListening).toHaveBeenCalled();
      expect(manager.getTotalEndpointCount()).toBe(0);
    });

    it('should handle errors during shutdown gracefully', async () => {
      mockEndpoint.stopListening.mockRejectedValue(new Error('Stop failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await manager.shutdown();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error stopping endpoint'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('utility methods', () => {
    beforeEach(async () => {
      mockEndpoint.getId.mockReturnValue('endpoint-1');
      mockEndpoint.getPort.mockReturnValue(8000);
      mockEndpoint.isActive.mockReturnValue(true);
      mockEndpoint.getStatus.mockReturnValue({
        id: 'endpoint-1',
        port: 8000,
        status: 'active',
        bufferSize: 100,
        addressFilters: [],
        createdAt: new Date(),
        messageCount: 0,
      });
      mockEndpoint.startListening.mockResolvedValue();

      await manager.createEndpoint({ port: 8000 });
    });

    it('should return correct active endpoint count', () => {
      expect(manager.getActiveEndpointCount()).toBe(1);
    });

    it('should return correct total endpoint count', () => {
      expect(manager.getTotalEndpointCount()).toBe(1);
    });

    it('should check if port is in use', () => {
      expect(manager.isPortInUse(8000)).toBe(true);
      expect(manager.isPortInUse(8001)).toBe(false);
    });

    it('should return used ports', () => {
      const usedPorts = manager.getUsedPorts();
      expect(usedPorts).toEqual([8000]);
    });

    it('should handle inactive endpoints in port checks', () => {
      mockEndpoint.isActive.mockReturnValue(false);

      expect(manager.isPortInUse(8000)).toBe(false);
      expect(manager.getUsedPorts()).toEqual([]);
      expect(manager.getActiveEndpointCount()).toBe(0);
    });
  });

  describe('event forwarding', () => {
    let messageHandler: ((message: any) => void) | undefined;
    let errorHandler: ((error: any) => void) | undefined;

    beforeEach(async () => {
      mockEndpoint.getId.mockReturnValue('endpoint-1');
      mockEndpoint.getPort.mockReturnValue(8000);
      mockEndpoint.isActive.mockReturnValue(true);
      mockEndpoint.getStatus.mockReturnValue({
        id: 'endpoint-1',
        port: 8000,
        status: 'active',
        bufferSize: 100,
        addressFilters: [],
        createdAt: new Date(),
        messageCount: 0,
      });
      mockEndpoint.startListening.mockResolvedValue();

      await manager.createEndpoint({ port: 8000 });

      // Get the event handlers that were registered
      const onCalls = mockEndpoint.on.mock.calls;
      messageHandler = onCalls.find((call: any) => call[0] === 'message')?.[1];
      errorHandler = onCalls.find((call: any) => call[0] === 'error')?.[1];
    });

    it('should forward message events', () => {
      const messageReceivedHandler = jest.fn();
      manager.on('messageReceived', messageReceivedHandler);

      const testMessage = {
        timestamp: new Date(),
        address: '/test',
        typeTags: 'f',
        arguments: [440.0],
        sourceIp: '192.168.1.100',
        sourcePort: 57120,
      };

      if (messageHandler) {
        messageHandler(testMessage);
      }

      expect(messageReceivedHandler).toHaveBeenCalledWith('endpoint-1', testMessage);
    });

    it('should forward error events', () => {
      const endpointErrorHandler = jest.fn();
      manager.on('endpointError', endpointErrorHandler);

      const testError = {
        code: ErrorCode.NETWORK_ERROR,
        message: 'Test error',
      };

      if (errorHandler) {
        errorHandler(testError);
      }

      expect(endpointErrorHandler).toHaveBeenCalledWith('endpoint-1', testError);
    });
  });
});
