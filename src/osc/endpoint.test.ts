/**
 * Unit tests for OSCEndpoint class
 */

import { OSCEndpoint, createOSCEndpoint } from './endpoint';
import { OSCEndpointConfig, ErrorCode } from '../types/index';
import { createSocket } from 'dgram';

// Mock dgram module
jest.mock('dgram');
const mockCreateSocket = createSocket as jest.MockedFunction<typeof createSocket>;

describe('OSCEndpoint', () => {
  let mockSocket: any;
  let endpoint: OSCEndpoint;
  const testConfig: OSCEndpointConfig = {
    port: 8000,
    bufferSize: 100,
    addressFilters: ['/test/*'],
  };

  beforeEach(() => {
    // Create mock socket
    mockSocket = {
      bind: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      removeAllListeners: jest.fn(),
    };

    mockCreateSocket.mockReturnValue(mockSocket);

    // Create endpoint
    endpoint = createOSCEndpoint('test-endpoint', testConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create endpoint with valid configuration', () => {
      const status = endpoint.getStatus();

      expect(status.id).toBe('test-endpoint');
      expect(status.port).toBe(8000);
      expect(status.bufferSize).toBe(100);
      expect(status.addressFilters).toEqual(['/test/*']);
      expect(status.status).toBe('stopped');
      expect(status.messageCount).toBe(0);
      expect(status.createdAt).toBeInstanceOf(Date);
    });

    it('should use default buffer size when not specified', () => {
      const configWithoutBuffer: OSCEndpointConfig = { port: 8001 };
      const endpointWithDefaults = createOSCEndpoint('test-defaults', configWithoutBuffer);

      expect(endpointWithDefaults.getStatus().bufferSize).toBe(1000);
    });

    it('should use empty address filters when not specified', () => {
      const configWithoutFilters: OSCEndpointConfig = { port: 8002 };
      const endpointWithDefaults = createOSCEndpoint('test-no-filters', configWithoutFilters);

      expect(endpointWithDefaults.getStatus().addressFilters).toEqual([]);
    });

    it('should throw error for invalid port numbers', () => {
      expect(() => {
        createOSCEndpoint('invalid-port-low', { port: 1023 });
      }).toThrow('Invalid port number: 1023');

      expect(() => {
        createOSCEndpoint('invalid-port-high', { port: 65536 });
      }).toThrow('Invalid port number: 65536');

      expect(() => {
        createOSCEndpoint('invalid-port-float', { port: 8000.5 });
      }).toThrow('Invalid port number: 8000.5');
    });
  });

  describe('startListening', () => {
    it('should start listening successfully', async () => {
      // Mock successful bind
      mockSocket.bind.mockImplementation((_port: number, callback: () => void) => {
        setTimeout(callback, 0);
      });

      const statusChangeHandler = jest.fn();
      endpoint.on('statusChange', statusChangeHandler);

      await endpoint.startListening();

      expect(mockCreateSocket).toHaveBeenCalledWith('udp4');
      expect(mockSocket.bind).toHaveBeenCalledWith(8000, expect.any(Function));
      expect(endpoint.getStatus().status).toBe('active');
      expect(statusChangeHandler).toHaveBeenCalledWith('active');
    });

    it('should set up error and message handlers', async () => {
      mockSocket.bind.mockImplementation((_port: number, callback: () => void) => {
        setTimeout(callback, 0);
      });

      await endpoint.startListening();

      expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('should reject if already listening', async () => {
      mockSocket.bind.mockImplementation((_port: number, callback: () => void) => {
        setTimeout(callback, 0);
      });

      await endpoint.startListening();

      await expect(endpoint.startListening()).rejects.toThrow(
        "Endpoint 'test-endpoint' is already active and listening"
      );
    });

    it('should handle socket errors during startup', async () => {
      const testError = new Error('EADDRINUSE: Address already in use');

      // Set up error handler to capture the error
      const errorHandler = jest.fn();
      endpoint.on('error', errorHandler);

      mockSocket.bind.mockImplementation(() => {
        // Simulate socket error during bind
        setTimeout(() => {
          const errorCallback = mockSocket.on.mock.calls.find(
            (call: any) => call[0] === 'error'
          )?.[1];
          if (errorCallback) {
            errorCallback(testError);
          }
        }, 0);
      });

      await expect(endpoint.startListening()).rejects.toThrow(testError);
      expect(endpoint.getStatus().status).toBe('error');
    });
  });

  describe('stopListening', () => {
    beforeEach(async () => {
      mockSocket.bind.mockImplementation((_port: number, callback: () => void) => {
        setTimeout(callback, 0);
      });
      await endpoint.startListening();
    });

    it('should stop listening successfully', async () => {
      mockSocket.close.mockImplementation((callback: () => void) => {
        setTimeout(callback, 0);
      });

      const statusChangeHandler = jest.fn();
      endpoint.on('statusChange', statusChangeHandler);

      await endpoint.stopListening();

      expect(mockSocket.close).toHaveBeenCalled();
      expect(endpoint.getStatus().status).toBe('stopped');
      expect(statusChangeHandler).toHaveBeenCalledWith('stopped');
    });

    it('should handle multiple stop calls gracefully', async () => {
      mockSocket.close.mockImplementation((callback: () => void) => {
        setTimeout(callback, 0);
      });

      await endpoint.stopListening();
      await endpoint.stopListening(); // Should not throw

      expect(endpoint.getStatus().status).toBe('stopped');
    });

    it('should handle stop when not started', async () => {
      const stoppedEndpoint = createOSCEndpoint('stopped-test', { port: 8003 });

      await stoppedEndpoint.stopListening(); // Should not throw
      expect(stoppedEndpoint.getStatus().status).toBe('stopped');
    });
  });

  describe('message handling', () => {
    let messageHandler: (data: Buffer, rinfo: any) => void;

    beforeEach(async () => {
      mockSocket.bind.mockImplementation((_port: number, callback: () => void) => {
        setTimeout(callback, 0);
      });

      await endpoint.startListening();

      // Get the message handler that was registered
      messageHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === 'message')[1];
    });

    it('should parse and store valid OSC messages', () => {
      const messageEventHandler = jest.fn();
      endpoint.on('message', messageEventHandler);

      // Create a simple OSC message buffer: "/test\0\0\0,f\0\0A\x88\0\0" (address + type tags + float 17.0)
      const oscMessage = Buffer.from([
        0x2f,
        0x74,
        0x65,
        0x73,
        0x74,
        0x00,
        0x00,
        0x00, // "/test\0\0\0"
        0x2c,
        0x66,
        0x00,
        0x00, // ",f\0\0"
        0x41,
        0x88,
        0x00,
        0x00, // float 17.0
      ]);

      const rinfo = {
        address: '192.168.1.100',
        port: 57120,
        family: 'IPv4',
        size: oscMessage.length,
      };

      messageHandler(oscMessage, rinfo);

      expect(messageEventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          address: '/test',
          typeTags: 'f',
          arguments: [17.0],
          sourceIp: '192.168.1.100',
          sourcePort: 57120,
        })
      );

      expect(endpoint.getStatus().messageCount).toBe(1);
    });

    it('should emit error for malformed OSC messages', () => {
      const errorHandler = jest.fn();
      endpoint.on('error', errorHandler);

      // Invalid OSC message (too short)
      const invalidMessage = Buffer.from([0x2f, 0x74]);
      const rinfo = { address: '192.168.1.100', port: 57120, family: 'IPv4', size: 2 };

      messageHandler(invalidMessage, rinfo);

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCode.INVALID_OSC_MESSAGE,
          message: expect.stringContaining('OSC message too short'),
        })
      );

      expect(endpoint.getStatus().messageCount).toBe(0);
    });

    it('should continue listening after parse errors', () => {
      const errorHandler = jest.fn();
      const messageEventHandler = jest.fn();
      endpoint.on('error', errorHandler);
      endpoint.on('message', messageEventHandler);

      // Send invalid message
      const invalidMessage = Buffer.from([0x2f, 0x74]);
      const rinfo1 = { address: '192.168.1.100', port: 57120, family: 'IPv4', size: 2 };
      messageHandler(invalidMessage, rinfo1);

      // Send valid message
      const validMessage = Buffer.from([
        0x2f, 0x74, 0x65, 0x73, 0x74, 0x00, 0x00, 0x00, 0x2c, 0x66, 0x00, 0x00, 0x41, 0x88, 0x00,
        0x00,
      ]);
      const rinfo2 = { address: '192.168.1.100', port: 57120, family: 'IPv4', size: 16 };
      messageHandler(validMessage, rinfo2);

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(messageEventHandler).toHaveBeenCalledTimes(1);
      expect(endpoint.getStatus().messageCount).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should handle port in use error', async () => {
      const errorEventHandler = jest.fn();
      const statusChangeHandler = jest.fn();
      endpoint.on('error', errorEventHandler);
      endpoint.on('statusChange', statusChangeHandler);

      // Start listening to set up the socket
      mockSocket.bind.mockImplementation((_port: number, callback: () => void) => {
        setTimeout(callback, 0);
      });
      await endpoint.startListening();

      // Now trigger the error
      const portError = new Error('EADDRINUSE: Address already in use');
      const errorCallback = mockSocket.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
      if (errorCallback) {
        errorCallback(portError);
      }

      expect(endpoint.getStatus().status).toBe('error');
      expect(statusChangeHandler).toHaveBeenCalledWith('error');
      expect(errorEventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCode.PORT_IN_USE,
          message: 'Port 8000 is already in use. Please try a different port.',
          details: expect.objectContaining({
            port: 8000,
            suggestedPorts: [8001, 8002, 8003],
          }),
        })
      );
    });

    it('should handle permission denied error', async () => {
      const errorEventHandler = jest.fn();
      endpoint.on('error', errorEventHandler);

      // Start listening to set up the socket
      mockSocket.bind.mockImplementation((_port: number, callback: () => void) => {
        setTimeout(callback, 0);
      });
      await endpoint.startListening();

      // Now trigger the error
      const permissionError = new Error('EACCES: Permission denied');
      const errorCallback = mockSocket.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
      if (errorCallback) {
        errorCallback(permissionError);
      }

      expect(errorEventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCode.PERMISSION_DENIED,
          message:
            'Permission denied to bind to port 8000. Try using a port number above 1024 or run with appropriate privileges.',
        })
      );
    });

    it('should handle generic network errors', async () => {
      const errorEventHandler = jest.fn();
      endpoint.on('error', errorEventHandler);

      // Start listening to set up the socket
      mockSocket.bind.mockImplementation((_port: number, callback: () => void) => {
        setTimeout(callback, 0);
      });
      await endpoint.startListening();

      // Now trigger the error
      const networkError = new Error('Some network error');
      const errorCallback = mockSocket.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
      if (errorCallback) {
        errorCallback(networkError);
      }

      expect(errorEventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCode.NETWORK_ERROR,
          message: 'Network error: Network error on endpoint test-endpoint: Some network error',
        })
      );
    });
  });

  describe('utility methods', () => {
    it('should return correct ID', () => {
      expect(endpoint.getId()).toBe('test-endpoint');
    });

    it('should return correct port', () => {
      expect(endpoint.getPort()).toBe(8000);
    });

    it('should return correct active status', async () => {
      expect(endpoint.isActive()).toBe(false);

      mockSocket.bind.mockImplementation((_port: number, callback: () => void) => {
        setTimeout(callback, 0);
      });

      await endpoint.startListening();
      expect(endpoint.isActive()).toBe(true);

      mockSocket.close.mockImplementation((callback: () => void) => {
        setTimeout(callback, 0);
      });

      await endpoint.stopListening();
      expect(endpoint.isActive()).toBe(false);
    });

    it('should provide access to message buffer', () => {
      const buffer = endpoint.getMessageBuffer();
      expect(buffer).toBeDefined();
      expect(typeof buffer.addMessage).toBe('function');
      expect(typeof buffer.getMessages).toBe('function');
    });
  });

  describe('integration with message buffer', () => {
    beforeEach(async () => {
      mockSocket.bind.mockImplementation((_port: number, callback: () => void) => {
        setTimeout(callback, 0);
      });

      await endpoint.startListening();
    });

    it('should store messages in buffer with address filtering', () => {
      // Create endpoint with address filter
      const filteredEndpoint = createOSCEndpoint('filtered', {
        port: 8004,
        addressFilters: ['/synth/*'],
      });

      // Mock socket for filtered endpoint
      const filteredMockSocket = {
        bind: jest.fn((_port: number, callback: () => void) => setTimeout(callback, 0)),
        close: jest.fn(),
        on: jest.fn(),
        removeAllListeners: jest.fn(),
      } as any;
      mockCreateSocket.mockReturnValue(filteredMockSocket);

      return filteredEndpoint.startListening().then(() => {
        const filteredMessageHandler = filteredMockSocket.on.mock.calls.find(
          (call: any) => call[0] === 'message'
        )[1];

        // Message that matches filter
        const matchingMessage = Buffer.from([
          0x2f,
          0x73,
          0x79,
          0x6e,
          0x74,
          0x68,
          0x2f,
          0x66,
          0x72,
          0x65,
          0x71,
          0x00, // "/synth/freq\0"
          0x2c,
          0x66,
          0x00,
          0x00, // ",f\0\0"
          0x41,
          0x88,
          0x00,
          0x00, // float 17.0
        ]);

        // Message that doesn't match filter
        const nonMatchingMessage = Buffer.from([
          0x2f,
          0x64,
          0x72,
          0x75,
          0x6d,
          0x2f,
          0x6b,
          0x69,
          0x63,
          0x6b,
          0x00,
          0x00, // "/drum/kick\0\0"
          0x2c,
          0x66,
          0x00,
          0x00, // ",f\0\0"
          0x42,
          0x20,
          0x00,
          0x00, // float 40.0
        ]);

        const rinfo = { address: '192.168.1.100', port: 57120, family: 'IPv4', size: 16 };

        filteredMessageHandler(matchingMessage, rinfo);
        filteredMessageHandler(nonMatchingMessage, rinfo);

        const buffer = filteredEndpoint.getMessageBuffer();
        const messages = buffer.getMessages();

        expect(messages).toHaveLength(1);
        expect(messages[0]?.address).toBe('/synth/freq');
      });
    });
  });
});
