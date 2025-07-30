/**
 * Comprehensive Error Handling System
 * 
 * This module provides structured error handling with user-friendly messages,
 * error codes, and proper error responses for all failure cases.
 */

import { ErrorCode, OSCError } from '../types/index';

/**
 * Creates a structured OSC error with consistent formatting
 */
export function createOSCError(
  code: ErrorCode,
  message: string,
  details?: Record<string, any>
): OSCError {
  return {
    code,
    message,
    details: details || {}
  };
}

/**
 * Network-related error creators
 */
export class NetworkErrors {
  static portInUse(port: number, suggestedPorts: number[] = []): OSCError {
    return createOSCError(
      ErrorCode.PORT_IN_USE,
      `Port ${port} is already in use. Please try a different port.`,
      {
        port,
        suggestedPorts: suggestedPorts.length > 0 ? suggestedPorts : [port + 1, port + 2, port + 3]
      }
    );
  }

  static portInvalid(port: number): OSCError {
    return createOSCError(
      ErrorCode.PORT_INVALID,
      `Invalid port number: ${port}. Port must be between 1024 and 65535.`,
      {
        port,
        validRange: { min: 1024, max: 65535 }
      }
    );
  }

  static permissionDenied(port: number): OSCError {
    return createOSCError(
      ErrorCode.PERMISSION_DENIED,
      `Permission denied to bind to port ${port}. Try using a port number above 1024 or run with appropriate privileges.`,
      {
        port,
        suggestion: 'Use a port number above 1024 or run with appropriate privileges'
      }
    );
  }

  static networkError(message: string, details?: Record<string, any>): OSCError {
    return createOSCError(
      ErrorCode.NETWORK_ERROR,
      `Network error: ${message}`,
      details
    );
  }
}

/**
 * Endpoint-related error creators
 */
export class EndpointErrors {
  static notFound(endpointId: string): OSCError {
    return createOSCError(
      ErrorCode.ENDPOINT_NOT_FOUND,
      `Endpoint '${endpointId}' not found. Please check the endpoint ID and try again.`,
      { endpointId }
    );
  }

  static alreadyExists(endpointId: string, port: number): OSCError {
    return createOSCError(
      ErrorCode.ENDPOINT_ALREADY_EXISTS,
      `An endpoint already exists on port ${port}. Each port can only have one active endpoint.`,
      { endpointId, port }
    );
  }

  static startFailed(endpointId: string, reason: string): OSCError {
    return createOSCError(
      ErrorCode.ENDPOINT_START_FAILED,
      `Failed to start endpoint '${endpointId}': ${reason}`,
      { endpointId, reason }
    );
  }

  static alreadyActive(endpointId: string): OSCError {
    return createOSCError(
      ErrorCode.ENDPOINT_ALREADY_EXISTS,
      `Endpoint '${endpointId}' is already active and listening.`,
      { endpointId }
    );
  }

  static alreadyStopped(endpointId: string): OSCError {
    return createOSCError(
      ErrorCode.ENDPOINT_NOT_FOUND,
      `Endpoint '${endpointId}' is already stopped or does not exist.`,
      { endpointId }
    );
  }
}

/**
 * Message parsing error creators
 */
export class MessageErrors {
  static parseError(reason: string, details?: Record<string, any>): OSCError {
    return createOSCError(
      ErrorCode.MESSAGE_PARSE_ERROR,
      `Failed to parse OSC message: ${reason}`,
      details
    );
  }

  static invalidMessage(reason: string): OSCError {
    return createOSCError(
      ErrorCode.INVALID_OSC_MESSAGE,
      `Invalid OSC message format: ${reason}`,
      { reason }
    );
  }

  static unsupportedType(typeTag: string): OSCError {
    return createOSCError(
      ErrorCode.MESSAGE_PARSE_ERROR,
      `Unsupported OSC type tag '${typeTag}'. Supported types: i (int32), f (float32), s (string), b (blob).`,
      {
        unsupportedType: typeTag,
        supportedTypes: ['i', 'f', 's', 'b']
      }
    );
  }
}

/**
 * Parameter validation error creators
 */
export class ValidationErrors {
  static missingParameter(paramName: string): OSCError {
    return createOSCError(
      ErrorCode.MISSING_REQUIRED_PARAMETER,
      `Missing required parameter: '${paramName}'`,
      { paramName }
    );
  }

  static invalidParameter(paramName: string, value: any, expectedType: string): OSCError {
    return createOSCError(
      ErrorCode.INVALID_PARAMETERS,
      `Invalid parameter '${paramName}': expected ${expectedType}, got ${typeof value}`,
      {
        paramName,
        providedValue: value,
        expectedType
      }
    );
  }

  static parameterOutOfRange(paramName: string, value: number, min: number, max: number): OSCError {
    return createOSCError(
      ErrorCode.INVALID_PARAMETERS,
      `Parameter '${paramName}' value ${value} is out of range. Must be between ${min} and ${max}.`,
      {
        paramName,
        value,
        validRange: { min, max }
      }
    );
  }

  static invalidAddressPattern(pattern: string): OSCError {
    return createOSCError(
      ErrorCode.INVALID_PARAMETERS,
      `Invalid OSC address pattern: '${pattern}'. Address patterns must start with '/' and contain valid OSC characters.`,
      {
        pattern,
        requirements: 'Must start with \'/\' and contain valid OSC characters'
      }
    );
  }
}

/**
 * General operation error creators
 */
export class OperationErrors {
  static internalError(message: string, details?: Record<string, any>): OSCError {
    return createOSCError(
      ErrorCode.INTERNAL_ERROR,
      `Internal error: ${message}`,
      details
    );
  }

  static operationFailed(operation: string, reason: string): OSCError {
    return createOSCError(
      ErrorCode.OPERATION_FAILED,
      `Operation '${operation}' failed: ${reason}`,
      { operation, reason }
    );
  }
}

/**
 * Utility functions for error handling
 */
export class ErrorUtils {
  /**
   * Converts a generic Error to an OSCError
   */
  static fromError(error: Error, code: ErrorCode = ErrorCode.INTERNAL_ERROR): OSCError {
    return createOSCError(
      code,
      error.message,
      {
        originalError: error.name,
        stack: error.stack
      }
    );
  }

  /**
   * Checks if an error is a network-related error
   */
  static isNetworkError(error: OSCError): boolean {
    return [
      ErrorCode.PORT_IN_USE,
      ErrorCode.PORT_INVALID,
      ErrorCode.PERMISSION_DENIED,
      ErrorCode.NETWORK_ERROR
    ].includes(error.code);
  }

  /**
   * Checks if an error is recoverable (user can retry with different parameters)
   */
  static isRecoverable(error: OSCError): boolean {
    return [
      ErrorCode.PORT_IN_USE,
      ErrorCode.PORT_INVALID,
      ErrorCode.INVALID_PARAMETERS,
      ErrorCode.MISSING_REQUIRED_PARAMETER
    ].includes(error.code);
  }

  /**
   * Gets user-friendly suggestions for resolving an error
   */
  static getSuggestions(error: OSCError): string[] {
    const suggestions: string[] = [];

    switch (error.code) {
      case ErrorCode.PORT_IN_USE:
        suggestions.push('Try using a different port number');
        if (error.details?.['suggestedPorts']) {
          suggestions.push(`Suggested ports: ${error.details['suggestedPorts'].join(', ')}`);
        }
        break;

      case ErrorCode.PORT_INVALID:
        suggestions.push('Use a port number between 1024 and 65535');
        break;

      case ErrorCode.PERMISSION_DENIED:
        suggestions.push('Use a port number above 1024');
        suggestions.push('Run the application with appropriate privileges');
        break;

      case ErrorCode.ENDPOINT_NOT_FOUND:
        suggestions.push('Check that the endpoint ID is correct');
        suggestions.push('Use get_endpoint_status to see available endpoints');
        break;

      case ErrorCode.MESSAGE_PARSE_ERROR:
        suggestions.push('Ensure the sender is using valid OSC 1.0 format');
        suggestions.push('Check that the message is not corrupted');
        break;

      case ErrorCode.INVALID_PARAMETERS:
        suggestions.push('Check the parameter types and values');
        suggestions.push('Refer to the tool documentation for valid parameter formats');
        break;
    }

    return suggestions;
  }
}

/**
 * Error response formatter for MCP tools
 */
export function formatErrorResponse(error: OSCError): any {
  return {
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
      suggestions: ErrorUtils.getSuggestions(error)
    }
  };
}