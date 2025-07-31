/**
 * TypeScript type definitions for the OSC MCP Server
 *
 * This file contains all the interfaces and types used throughout the application.
 */

// ============================================================================
// OSC Protocol Types
// ============================================================================

/**
 * Represents a parsed OSC message with all its components
 */
export interface OSCMessage {
  /** Timestamp when the message was received */
  timestamp: Date;
  /** OSC address pattern (e.g., "/synth/freq") */
  address: string;
  /** OSC type tags string (e.g., "if" for int, float) */
  typeTags: string;
  /** Array of message arguments in order */
  arguments: OSCArgument[];
  /** Source IP address of the sender */
  sourceIp: string;
  /** Source port of the sender */
  sourcePort: number;
}

/**
 * Valid OSC argument types
 */
export type OSCArgument = number | string | Buffer;

/**
 * OSC data type identifiers
 */
export enum OSCType {
  INT32 = 'i',
  FLOAT32 = 'f',
  STRING = 's',
  BLOB = 'b',
}

// ============================================================================
// OSC Endpoint Types
// ============================================================================

/**
 * Represents an OSC endpoint configuration and status information
 */
export interface OSCEndpointInfo {
  /** Unique identifier for the endpoint */
  id: string;
  /** UDP port number the endpoint is listening on */
  port: number;
  /** Current status of the endpoint */
  status: OSCEndpointStatus;
  /** Maximum number of messages to store in buffer */
  bufferSize: number;
  /** OSC address patterns to filter messages (empty array = no filtering) */
  addressFilters: string[];
  /** Timestamp when the endpoint was created */
  createdAt: Date;
  /** Total number of messages received by this endpoint */
  messageCount: number;
}

/**
 * Possible states of an OSC endpoint
 */
export type OSCEndpointStatus = 'active' | 'stopped' | 'error';

/**
 * Configuration for creating a new OSC endpoint
 */
export interface OSCEndpointConfig {
  /** UDP port to listen on (1024-65535) */
  port: number;
  /** Maximum messages to store (default: 1000) */
  bufferSize?: number;
  /** Address patterns to filter (optional) */
  addressFilters?: string[];
}

// ============================================================================
// MCP Tool Parameter Types
// ============================================================================

/**
 * Parameters for creating an OSC endpoint
 */
export interface CreateEndpointParams {
  /** Port number to listen on */
  port: number;
  /** Optional buffer size limit */
  bufferSize?: number;
  /** Optional address pattern filters */
  addressFilters?: string[];
}

/**
 * Parameters for stopping an OSC endpoint
 */
export interface StopEndpointParams {
  /** ID of the endpoint to stop */
  endpointId: string;
}

/**
 * Parameters for querying OSC messages
 */
export interface GetMessagesParams {
  /** Optional endpoint ID to query (if not provided, queries all) */
  endpointId?: string;
  /** Optional address pattern filter */
  addressPattern?: string;
  /** Optional time window in seconds (from now backwards) */
  timeWindowSeconds?: number;
  /** Optional limit on number of messages returned */
  limit?: number;
}

/**
 * Parameters for getting endpoint status
 */
export interface GetEndpointStatusParams {
  /** Optional endpoint ID (if not provided, returns all endpoints) */
  endpointId?: string;
}

// ============================================================================
// MCP Tool Response Types
// ============================================================================

/**
 * Response from creating an OSC endpoint
 */
export interface CreateEndpointResponse {
  /** ID of the created endpoint */
  endpointId: string;
  /** Port the endpoint is listening on */
  port: number;
  /** Current status */
  status: string;
  /** Success or error message */
  message: string;
}

/**
 * Response from stopping an OSC endpoint
 */
export interface StopEndpointResponse {
  /** ID of the stopped endpoint */
  endpointId: string;
  /** Success or error message */
  message: string;
}

/**
 * Response from querying OSC messages
 */
export interface MessageQueryResponse {
  /** Array of matching OSC messages */
  messages: OSCMessage[];
  /** Total number of messages in buffer */
  totalCount: number;
  /** Number of messages matching the filter criteria */
  filteredCount: number;
}

/**
 * Response from getting endpoint status
 */
export interface EndpointStatusResponse {
  /** Array of endpoint status information */
  endpoints: OSCEndpointInfo[];
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Standard error codes used throughout the application
 */
export enum ErrorCode {
  // Network errors
  PORT_IN_USE = 'PORT_IN_USE',
  PORT_INVALID = 'PORT_INVALID',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NETWORK_ERROR = 'NETWORK_ERROR',

  // Endpoint errors
  ENDPOINT_NOT_FOUND = 'ENDPOINT_NOT_FOUND',
  ENDPOINT_ALREADY_EXISTS = 'ENDPOINT_ALREADY_EXISTS',
  ENDPOINT_START_FAILED = 'ENDPOINT_START_FAILED',

  // Message errors
  MESSAGE_PARSE_ERROR = 'MESSAGE_PARSE_ERROR',
  INVALID_OSC_MESSAGE = 'INVALID_OSC_MESSAGE',

  // Parameter validation errors
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  MISSING_REQUIRED_PARAMETER = 'MISSING_REQUIRED_PARAMETER',

  // General errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  OPERATION_FAILED = 'OPERATION_FAILED',
}

/**
 * Structured error information
 */
export interface OSCError {
  /** Error code for programmatic handling */
  code: ErrorCode;
  /** Human-readable error message */
  message: string;
  /** Optional additional error details */
  details?: Record<string, any>;
}

/**
 * Error response format for MCP tools
 */
export interface ErrorResponse {
  /** Error information */
  error: OSCError;
}

// ============================================================================
// Message Buffer Types
// ============================================================================

/**
 * Configuration for message buffer behavior
 */
export interface MessageBufferConfig {
  /** Maximum number of messages to store */
  maxSize: number;
  /** Address patterns to filter incoming messages */
  addressFilters: string[];
}

/**
 * Query filters for retrieving messages from buffer
 */
export interface MessageQuery {
  /** Filter by address pattern (supports wildcards) */
  addressPattern?: string;
  /** Only return messages newer than this timestamp */
  since?: Date;
  /** Only return messages older than this timestamp */
  until?: Date;
  /** Maximum number of messages to return */
  limit?: number;
}

// ============================================================================
// Network Types
// ============================================================================

/**
 * UDP socket information
 */
export interface SocketInfo {
  /** Local IP address */
  address: string;
  /** Local port number */
  port: number;
  /** Address family (IPv4/IPv6) */
  family: string;
}

/**
 * Information about a remote OSC sender
 */
export interface RemoteInfo {
  /** Remote IP address */
  address: string;
  /** Remote port number */
  port: number;
  /** Address family */
  family: string;
  /** Size of the received message in bytes */
  size: number;
}
