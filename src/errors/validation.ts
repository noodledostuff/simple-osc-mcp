/**
 * Parameter Validation Module
 *
 * Provides comprehensive validation for all tool parameters and configurations
 * with detailed error messages and suggestions.
 */

import { ValidationErrors } from './index';
import { OSCError } from '../types/index';

/**
 * Validation result type
 */
export interface ValidationResult {
  isValid: boolean;
  error?: OSCError;
}

/**
 * Creates a successful validation result
 */
function validResult(): ValidationResult {
  return { isValid: true };
}

/**
 * Creates a failed validation result
 */
function invalidResult(error: OSCError): ValidationResult {
  return { isValid: false, error };
}

/**
 * Validates port numbers
 */
export function validatePort(port: any): ValidationResult {
  // Check if port is provided
  if (port === undefined || port === null) {
    return invalidResult(ValidationErrors.missingParameter('port'));
  }

  // Check if port is a number
  if (typeof port !== 'number' || !Number.isInteger(port)) {
    return invalidResult(ValidationErrors.invalidParameter('port', port, 'integer'));
  }

  // Check port range
  if (port < 1024 || port > 65535) {
    return invalidResult(ValidationErrors.parameterOutOfRange('port', port, 1024, 65535));
  }

  return validResult();
}

/**
 * Validates buffer size parameter
 */
export function validateBufferSize(bufferSize: any): ValidationResult {
  // Buffer size is optional
  if (bufferSize === undefined || bufferSize === null) {
    return validResult();
  }

  // Check if buffer size is a number
  if (typeof bufferSize !== 'number' || !Number.isInteger(bufferSize)) {
    return invalidResult(ValidationErrors.invalidParameter('bufferSize', bufferSize, 'integer'));
  }

  // Check buffer size range
  if (bufferSize < 1 || bufferSize > 10000) {
    return invalidResult(ValidationErrors.parameterOutOfRange('bufferSize', bufferSize, 1, 10000));
  }

  return validResult();
}

/**
 * Validates OSC address pattern
 */
export function validateAddressPattern(pattern: string): ValidationResult {
  // Must start with '/'
  if (!pattern.startsWith('/')) {
    return invalidResult(ValidationErrors.invalidAddressPattern(pattern));
  }

  // Check for invalid characters (basic validation)
  const invalidChars = /[<>"|\\]/;
  if (invalidChars.test(pattern)) {
    return invalidResult(ValidationErrors.invalidAddressPattern(pattern));
  }

  return validResult();
}

/**
 * Validates address filters array
 */
export function validateAddressFilters(filters: any): ValidationResult {
  // Address filters are optional
  if (filters === undefined || filters === null) {
    return validResult();
  }

  // Must be an array
  if (!Array.isArray(filters)) {
    return invalidResult(ValidationErrors.invalidParameter('addressFilters', filters, 'array'));
  }

  // Validate each filter
  for (let i = 0; i < filters.length; i++) {
    const filter = filters[i];

    // Each filter must be a string
    if (typeof filter !== 'string') {
      return invalidResult(
        ValidationErrors.invalidParameter(`addressFilters[${i}]`, filter, 'string')
      );
    }

    // Validate the address pattern
    const patternResult = validateAddressPattern(filter);
    if (!patternResult.isValid) {
      return patternResult;
    }
  }

  return validResult();
}

/**
 * Validates endpoint ID parameter
 */
export function validateEndpointId(endpointId: any): ValidationResult {
  // Check if endpoint ID is provided
  if (endpointId === undefined || endpointId === null || endpointId === '') {
    return invalidResult(ValidationErrors.missingParameter('endpointId'));
  }

  // Check if endpoint ID is a string
  if (typeof endpointId !== 'string') {
    return invalidResult(ValidationErrors.invalidParameter('endpointId', endpointId, 'string'));
  }

  // Check endpoint ID format (basic validation)
  if (endpointId.trim().length === 0) {
    return invalidResult(
      ValidationErrors.invalidParameter('endpointId', endpointId, 'non-empty string')
    );
  }

  return validResult();
}

/**
 * Validates time window parameter
 */
export function validateTimeWindow(timeWindowSeconds: any): ValidationResult {
  // Time window is optional
  if (timeWindowSeconds === undefined || timeWindowSeconds === null) {
    return validResult();
  }

  // Check if time window is a number
  if (typeof timeWindowSeconds !== 'number') {
    return invalidResult(
      ValidationErrors.invalidParameter('timeWindowSeconds', timeWindowSeconds, 'number')
    );
  }

  // Check time window range
  if (timeWindowSeconds < 1 || timeWindowSeconds > 86400) {
    // Max 24 hours
    return invalidResult(
      ValidationErrors.parameterOutOfRange('timeWindowSeconds', timeWindowSeconds, 1, 86400)
    );
  }

  return validResult();
}

/**
 * Validates limit parameter
 */
export function validateLimit(limit: any): ValidationResult {
  // Limit is optional
  if (limit === undefined || limit === null) {
    return validResult();
  }

  // Check if limit is a number
  if (typeof limit !== 'number' || !Number.isInteger(limit)) {
    return invalidResult(ValidationErrors.invalidParameter('limit', limit, 'integer'));
  }

  // Check limit range
  if (limit < 1 || limit > 1000) {
    return invalidResult(ValidationErrors.parameterOutOfRange('limit', limit, 1, 1000));
  }

  return validResult();
}

/**
 * Validates create endpoint parameters
 */
export function validateCreateEndpointParams(params: any): ValidationResult {
  if (!params || typeof params !== 'object') {
    return invalidResult(ValidationErrors.invalidParameter('params', params, 'object'));
  }

  // Validate port (required)
  const portResult = validatePort(params.port);
  if (!portResult.isValid) {
    return portResult;
  }

  // Validate buffer size (optional)
  const bufferSizeResult = validateBufferSize(params.bufferSize);
  if (!bufferSizeResult.isValid) {
    return bufferSizeResult;
  }

  // Validate address filters (optional)
  const filtersResult = validateAddressFilters(params.addressFilters);
  if (!filtersResult.isValid) {
    return filtersResult;
  }

  return validResult();
}

/**
 * Validates stop endpoint parameters
 */
export function validateStopEndpointParams(params: any): ValidationResult {
  if (!params || typeof params !== 'object') {
    return invalidResult(ValidationErrors.invalidParameter('params', params, 'object'));
  }

  // Validate endpoint ID (required)
  return validateEndpointId(params.endpointId);
}

/**
 * Validates get messages parameters
 */
export function validateGetMessagesParams(params: any): ValidationResult {
  if (!params || typeof params !== 'object') {
    return invalidResult(ValidationErrors.invalidParameter('params', params, 'object'));
  }

  // Validate endpoint ID (optional)
  if (params.endpointId !== undefined) {
    const endpointIdResult = validateEndpointId(params.endpointId);
    if (!endpointIdResult.isValid) {
      return endpointIdResult;
    }
  }

  // Validate address pattern (optional)
  if (params.addressPattern !== undefined) {
    if (typeof params.addressPattern !== 'string') {
      return invalidResult(
        ValidationErrors.invalidParameter('addressPattern', params.addressPattern, 'string')
      );
    }
    const patternResult = validateAddressPattern(params.addressPattern);
    if (!patternResult.isValid) {
      return patternResult;
    }
  }

  // Validate time window (optional)
  const timeWindowResult = validateTimeWindow(params.timeWindowSeconds);
  if (!timeWindowResult.isValid) {
    return timeWindowResult;
  }

  // Validate limit (optional)
  const limitResult = validateLimit(params.limit);
  if (!limitResult.isValid) {
    return limitResult;
  }

  return validResult();
}

/**
 * Validates get endpoint status parameters
 */
export function validateGetEndpointStatusParams(params: any): ValidationResult {
  if (!params || typeof params !== 'object') {
    return invalidResult(ValidationErrors.invalidParameter('params', params, 'object'));
  }

  // Validate endpoint ID (optional)
  if (params.endpointId !== undefined) {
    return validateEndpointId(params.endpointId);
  }

  return validResult();
}

/**
 * Comprehensive parameter validator that routes to specific validators
 */
export class ParameterValidator {
  static validateCreateEndpoint(params: any): ValidationResult {
    return validateCreateEndpointParams(params);
  }

  static validateStopEndpoint(params: any): ValidationResult {
    return validateStopEndpointParams(params);
  }

  static validateGetMessages(params: any): ValidationResult {
    return validateGetMessagesParams(params);
  }

  static validateGetEndpointStatus(params: any): ValidationResult {
    return validateGetEndpointStatusParams(params);
  }
}
