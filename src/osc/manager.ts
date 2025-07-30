/**
 * OSC Manager
 * 
 * Coordinates multiple OSC endpoints, providing centralized management
 * for creating, stopping, and querying OSC endpoints and their messages.
 */

import { EventEmitter } from 'events';
import { OSCEndpoint, createOSCEndpoint } from './endpoint';
import { 
  OSCEndpointInfo, 
  OSCEndpointConfig, 
  OSCMessage, 
  MessageQuery,
  OSCError,
  CreateEndpointResponse,
  StopEndpointResponse,
  MessageQueryResponse,
  EndpointStatusResponse
} from '../types/index';

/**
 * Events emitted by OSCManager
 */
export interface OSCManagerEvents {
  'endpointCreated': (endpointInfo: OSCEndpointInfo) => void;
  'endpointStopped': (endpointId: string) => void;
  'endpointError': (endpointId: string, error: OSCError) => void;
  'messageReceived': (endpointId: string, message: OSCMessage) => void;
}

/**
 * Manages multiple OSC endpoints and provides centralized access to OSC functionality
 */
export class OSCManager extends EventEmitter {
  private endpoints: Map<string, OSCEndpoint> = new Map();
  private nextEndpointId: number = 1;

  /**
   * Creates a new OSC endpoint and starts listening
   * 
   * @param config Endpoint configuration
   * @returns Promise resolving to endpoint creation response
   */
  async createEndpoint(config: OSCEndpointConfig): Promise<CreateEndpointResponse> {
    try {
      // Validate port availability by checking existing endpoints
      const existingEndpoint = this.findEndpointByPort(config.port);
      if (existingEndpoint && existingEndpoint.isActive()) {
        return {
          endpointId: '',
          port: config.port,
          status: 'error',
          message: `Port ${config.port} is already in use by endpoint ${existingEndpoint.getId()}`
        };
      }

      // Generate unique endpoint ID
      const endpointId = this.generateEndpointId();
      
      // Create endpoint
      const endpoint = createOSCEndpoint(endpointId, config);
      
      // Set up event handlers
      this.setupEndpointEventHandlers(endpoint);
      
      // Start listening
      await endpoint.startListening();
      
      // Store endpoint
      this.endpoints.set(endpointId, endpoint);
      
      // Get endpoint info and emit event
      const endpointInfo = endpoint.getStatus();
      this.emit('endpointCreated', endpointInfo);
      
      return {
        endpointId,
        port: config.port,
        status: 'active',
        message: `OSC endpoint created successfully on port ${config.port}`
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        endpointId: '',
        port: config.port,
        status: 'error',
        message: `Failed to create OSC endpoint: ${errorMessage}`
      };
    }
  }

  /**
   * Stops and removes an OSC endpoint
   * 
   * @param endpointId ID of the endpoint to stop
   * @returns Promise resolving to stop response
   */
  async stopEndpoint(endpointId: string): Promise<StopEndpointResponse> {
    const endpoint = this.endpoints.get(endpointId);
    
    if (!endpoint) {
      return {
        endpointId,
        message: `Endpoint ${endpointId} not found`
      };
    }

    try {
      // Stop the endpoint
      await endpoint.stopListening();
      
      // Remove from registry
      this.endpoints.delete(endpointId);
      
      // Emit event
      this.emit('endpointStopped', endpointId);
      
      return {
        endpointId,
        message: `Endpoint ${endpointId} stopped successfully`
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        endpointId,
        message: `Failed to stop endpoint ${endpointId}: ${errorMessage}`
      };
    }
  }

  /**
   * Gets status information for one or all endpoints
   * 
   * @param endpointId Optional specific endpoint ID
   * @returns Endpoint status response
   */
  getEndpointStatus(endpointId?: string): EndpointStatusResponse {
    if (endpointId) {
      const endpoint = this.endpoints.get(endpointId);
      if (!endpoint) {
        return { endpoints: [] };
      }
      return { endpoints: [endpoint.getStatus()] };
    }

    // Return all endpoints
    const endpoints = Array.from(this.endpoints.values()).map(endpoint => endpoint.getStatus());
    return { endpoints };
  }

  /**
   * Queries OSC messages from one or all endpoints
   * 
   * @param endpointId Optional specific endpoint ID
   * @param query Message query parameters
   * @returns Message query response
   */
  getMessages(endpointId?: string, query: MessageQuery = {}): MessageQueryResponse {
    let allMessages: OSCMessage[] = [];
    let totalCount = 0;

    if (endpointId) {
      // Query specific endpoint
      const endpoint = this.endpoints.get(endpointId);
      if (endpoint) {
        const buffer = endpoint.getMessageBuffer();
        allMessages = buffer.getMessages(query);
        totalCount = buffer.getMessageCount();
      }
    } else {
      // Query all endpoints
      for (const endpoint of this.endpoints.values()) {
        const buffer = endpoint.getMessageBuffer();
        const endpointMessages = buffer.getMessages(query);
        allMessages.push(...endpointMessages);
        totalCount += buffer.getMessageCount();
      }

      // Sort combined messages by timestamp (newest first)
      allMessages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Apply limit to combined results if specified
      if (query.limit !== undefined && query.limit > 0) {
        allMessages = allMessages.slice(0, query.limit);
      }
    }

    return {
      messages: allMessages,
      totalCount,
      filteredCount: allMessages.length
    };
  }

  /**
   * Gets messages from a specific time window across all or specific endpoints
   * 
   * @param timeWindowSeconds Number of seconds back from now
   * @param endpointId Optional specific endpoint ID
   * @param limit Optional limit on number of messages
   * @returns Recent messages
   */
  getRecentMessages(timeWindowSeconds: number, endpointId?: string, limit?: number): OSCMessage[] {
    const since = new Date(Date.now() - (timeWindowSeconds * 1000));
    const query: MessageQuery = { since };
    if (limit !== undefined) {
      query.limit = limit;
    }

    const response = this.getMessages(endpointId, query);
    return response.messages;
  }

  /**
   * Stops all endpoints and cleans up resources
   * 
   * @returns Promise that resolves when all endpoints are stopped
   */
  async shutdown(): Promise<void> {
    const stopPromises: Promise<void>[] = [];

    for (const [endpointId, endpoint] of this.endpoints) {
      stopPromises.push(
        endpoint.stopListening().catch(error => {
          console.error(`Error stopping endpoint ${endpointId}:`, error);
        })
      );
    }

    await Promise.all(stopPromises);
    this.endpoints.clear();
  }

  /**
   * Gets the number of active endpoints
   * 
   * @returns Number of active endpoints
   */
  getActiveEndpointCount(): number {
    return Array.from(this.endpoints.values()).filter(endpoint => endpoint.isActive()).length;
  }

  /**
   * Gets the total number of endpoints (active and inactive)
   * 
   * @returns Total number of endpoints
   */
  getTotalEndpointCount(): number {
    return this.endpoints.size;
  }

  /**
   * Checks if a specific port is in use by any endpoint
   * 
   * @param port Port number to check
   * @returns True if port is in use
   */
  isPortInUse(port: number): boolean {
    const endpoint = this.findEndpointByPort(port);
    return endpoint !== null && endpoint.isActive();
  }

  /**
   * Gets a list of all ports currently in use
   * 
   * @returns Array of port numbers in use
   */
  getUsedPorts(): number[] {
    return Array.from(this.endpoints.values())
      .filter(endpoint => endpoint.isActive())
      .map(endpoint => endpoint.getPort());
  }

  /**
   * Finds an endpoint by its port number
   * 
   * @param port Port number to search for
   * @returns OSCEndpoint if found, null otherwise
   */
  private findEndpointByPort(port: number): OSCEndpoint | null {
    for (const endpoint of this.endpoints.values()) {
      if (endpoint.getPort() === port) {
        return endpoint;
      }
    }
    return null;
  }

  /**
   * Generates a unique endpoint ID
   * 
   * @returns Unique endpoint ID string
   */
  private generateEndpointId(): string {
    const id = `endpoint-${this.nextEndpointId}`;
    this.nextEndpointId++;
    return id;
  }

  /**
   * Sets up event handlers for an endpoint
   * 
   * @param endpoint OSC endpoint to set up handlers for
   */
  private setupEndpointEventHandlers(endpoint: OSCEndpoint): void {
    const endpointId = endpoint.getId();

    // Forward message events
    endpoint.on('message', (message: OSCMessage) => {
      this.emit('messageReceived', endpointId, message);
    });

    // Forward error events
    endpoint.on('error', (error: OSCError) => {
      this.emit('endpointError', endpointId, error);
    });

    // Handle status changes
    endpoint.on('statusChange', (status) => {
      if (status === 'error') {
        // Endpoint encountered an error, we might want to remove it
        console.warn(`Endpoint ${endpointId} encountered an error and changed status to: ${status}`);
      }
    });
  }
}

/**
 * Creates a new OSC manager instance
 * 
 * @returns New OSCManager instance
 */
export function createOSCManager(): OSCManager {
  return new OSCManager();
}