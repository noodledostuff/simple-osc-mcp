/**
 * OSC Endpoint
 * 
 * Handles individual OSC listening endpoints with UDP socket management,
 * message reception, parsing, and integration with message buffer.
 */

import { createSocket, Socket, RemoteInfo } from 'dgram';
import { EventEmitter } from 'events';
import { OSCEndpointInfo, OSCEndpointConfig, OSCEndpointStatus, OSCMessage, ErrorCode, OSCError, MessageBufferConfig } from '../types/index';
import { parseOSCMessage } from './parser';
import { MessageBuffer, createMessageBuffer } from './buffer';
import { NetworkErrors, EndpointErrors } from '../errors/index';

/**
 * Events emitted by OSCEndpoint
 */
export interface OSCEndpointEvents {
  'message': (message: OSCMessage) => void;
  'error': (error: OSCError) => void;
  'statusChange': (status: OSCEndpointStatus) => void;
}

/**
 * Individual OSC endpoint that listens on a UDP port for OSC messages
 */
export class OSCEndpoint extends EventEmitter {
  private readonly id: string;
  private readonly port: number;
  private readonly bufferSize: number;
  private readonly addressFilters: string[];
  private readonly createdAt: Date;
  
  private socket: Socket | null = null;
  private status: OSCEndpointStatus = 'stopped';
  private messageBuffer: MessageBuffer;
  private messageCount: number = 0;

  /**
   * Creates a new OSC endpoint
   * 
   * @param id Unique identifier for this endpoint
   * @param config Endpoint configuration
   */
  constructor(id: string, config: OSCEndpointConfig) {
    super();
    
    this.id = id;
    this.port = config.port;
    this.bufferSize = config.bufferSize || 1000;
    this.addressFilters = config.addressFilters || [];
    this.createdAt = new Date();

    // Validate port range
    if (!this.isValidPort(this.port)) {
      const error = NetworkErrors.portInvalid(this.port);
      throw new Error(error.message);
    }

    // Create message buffer
    const bufferConfig: MessageBufferConfig = {
      maxSize: this.bufferSize,
      addressFilters: this.addressFilters
    };
    this.messageBuffer = createMessageBuffer(bufferConfig);
  }

  /**
   * Starts listening for OSC messages on the configured port
   * 
   * @returns Promise that resolves when listening starts successfully
   */
  async startListening(): Promise<void> {
    if (this.status === 'active') {
      const error = EndpointErrors.alreadyActive(this.id);
      throw new Error(error.message);
    }

    return new Promise((resolve, reject) => {
      try {
        // Create UDP socket
        this.socket = createSocket('udp4');

        // Set up error handling
        this.socket.on('error', (error: Error) => {
          this.handleSocketError(error);
          reject(error);
        });

        // Set up message handling
        this.socket.on('message', (data: Buffer, rinfo: RemoteInfo) => {
          this.handleIncomingMessage(data, rinfo);
        });

        // Start listening
        this.socket.bind(this.port, () => {
          this.status = 'active';
          this.emit('statusChange', this.status);
          resolve();
        });

      } catch (error) {
        this.status = 'error';
        this.emit('statusChange', this.status);
        const startError = EndpointErrors.startFailed(this.id, error instanceof Error ? error.message : 'Unknown error');
        reject(new Error(startError.message));
      }
    });
  }

  /**
   * Stops listening and closes the UDP socket
   * 
   * @returns Promise that resolves when socket is closed
   */
  async stopListening(): Promise<void> {
    if (this.status === 'stopped') {
      return; // Already stopped
    }

    return new Promise((resolve) => {
      if (this.socket) {
        this.socket.close(() => {
          this.socket = null;
          this.status = 'stopped';
          this.emit('statusChange', this.status);
          resolve();
        });
      } else {
        this.status = 'stopped';
        this.emit('statusChange', this.status);
        resolve();
      }
    });
  }

  /**
   * Gets the current status and information about this endpoint
   * 
   * @returns OSCEndpointInfo information object
   */
  getStatus(): OSCEndpointInfo {
    return {
      id: this.id,
      port: this.port,
      status: this.status,
      bufferSize: this.bufferSize,
      addressFilters: [...this.addressFilters],
      createdAt: this.createdAt,
      messageCount: this.messageCount
    };
  }

  /**
   * Gets the message buffer for this endpoint
   * 
   * @returns MessageBuffer instance
   */
  getMessageBuffer(): MessageBuffer {
    return this.messageBuffer;
  }

  /**
   * Gets the unique ID of this endpoint
   * 
   * @returns Endpoint ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * Gets the port this endpoint is configured to listen on
   * 
   * @returns Port number
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Checks if this endpoint is currently active (listening)
   * 
   * @returns True if endpoint is actively listening
   */
  isActive(): boolean {
    return this.status === 'active';
  }

  /**
   * Handles incoming UDP messages
   * 
   * @param data Raw message data
   * @param rinfo Remote sender information
   */
  private handleIncomingMessage(data: Buffer, rinfo: RemoteInfo): void {
    try {
      // Parse the OSC message
      const parseResult = parseOSCMessage(data, rinfo.address, rinfo.port);
      
      if (parseResult.error) {
        // Emit error but continue listening
        this.emit('error', parseResult.error);
        return;
      }

      if (parseResult.message) {
        // Store message in buffer
        this.messageBuffer.addMessage(parseResult.message);
        this.messageCount++;

        // Emit message event
        this.emit('message', parseResult.message);
      }

    } catch (error) {
      // Handle unexpected errors
      const oscError: OSCError = {
        code: ErrorCode.MESSAGE_PARSE_ERROR,
        message: `Unexpected error processing message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { originalError: error }
      };
      this.emit('error', oscError);
    }
  }

  /**
   * Handles socket errors
   * 
   * @param error Socket error
   */
  private handleSocketError(error: Error): void {
    this.status = 'error';
    this.emit('statusChange', this.status);

    // Convert Node.js socket errors to OSC errors using error creators
    let oscError: OSCError;

    if (error.message.includes('EADDRINUSE')) {
      oscError = NetworkErrors.portInUse(this.port, this.getSuggestedPorts());
    } else if (error.message.includes('EACCES')) {
      oscError = NetworkErrors.permissionDenied(this.port);
    } else {
      oscError = NetworkErrors.networkError(`Network error on endpoint ${this.id}: ${error.message}`, {
        originalError: error,
        port: this.port,
        endpointId: this.id
      });
    }

    this.emit('error', oscError);
  }

  /**
   * Validates if a port number is in the valid range
   * 
   * @param port Port number to validate
   * @returns True if port is valid
   */
  private isValidPort(port: number): boolean {
    return Number.isInteger(port) && port >= 1024 && port <= 65535;
  }

  /**
   * Generates suggested alternative ports when the requested port is in use
   * 
   * @returns Array of suggested port numbers
   */
  private getSuggestedPorts(): number[] {
    const suggestions: number[] = [];
    const basePort = this.port;
    
    // Suggest next 3 ports
    for (let i = 1; i <= 3; i++) {
      const suggestedPort = basePort + i;
      if (suggestedPort <= 65535) {
        suggestions.push(suggestedPort);
      }
    }
    
    return suggestions;
  }
}

/**
 * Creates a new OSC endpoint with the specified configuration
 * 
 * @param id Unique identifier for the endpoint
 * @param config Endpoint configuration
 * @returns New OSCEndpoint instance
 */
export function createOSCEndpoint(id: string, config: OSCEndpointConfig): OSCEndpoint {
  return new OSCEndpoint(id, config);
}