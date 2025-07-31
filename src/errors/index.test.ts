/**
 * Unit tests for comprehensive error handling system
 */

import {
  createOSCError,
  NetworkErrors,
  EndpointErrors,
  MessageErrors,
  ValidationErrors,
  OperationErrors,
  ErrorUtils,
  formatErrorResponse,
} from './index';
import { ErrorCode } from '../types/index';

// Helper function to safely access error details
function getErrorDetail(error: any, key: string): any {
  return error.details?.[key];
}

describe('Error Handling System', () => {
  describe('createOSCError', () => {
    it('should create a basic OSC error', () => {
      const error = createOSCError(ErrorCode.INTERNAL_ERROR, 'Test error');

      expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(error.message).toBe('Test error');
      expect(error.details).toEqual({});
    });

    it('should create an OSC error with details', () => {
      const details = { port: 8000, reason: 'test' };
      const error = createOSCError(ErrorCode.PORT_IN_USE, 'Port in use', details);

      expect(error.code).toBe(ErrorCode.PORT_IN_USE);
      expect(error.message).toBe('Port in use');
      expect(error.details).toEqual(details);
    });
  });

  describe('NetworkErrors', () => {
    it('should create port in use error', () => {
      const error = NetworkErrors.portInUse(8000, [8001, 8002]);

      expect(error.code).toBe(ErrorCode.PORT_IN_USE);
      expect(error.message).toContain('Port 8000 is already in use');
      expect(getErrorDetail(error, 'port')).toBe(8000);
      expect(getErrorDetail(error, 'suggestedPorts')).toEqual([8001, 8002]);
    });

    it('should create port invalid error', () => {
      const error = NetworkErrors.portInvalid(100);

      expect(error.code).toBe(ErrorCode.PORT_INVALID);
      expect(error.message).toContain('Invalid port number: 100');
      expect(getErrorDetail(error, 'port')).toBe(100);
      expect(getErrorDetail(error, 'validRange')).toEqual({ min: 1024, max: 65535 });
    });

    it('should create permission denied error', () => {
      const error = NetworkErrors.permissionDenied(80);

      expect(error.code).toBe(ErrorCode.PERMISSION_DENIED);
      expect(error.message).toContain('Permission denied to bind to port 80');
      expect(getErrorDetail(error, 'port')).toBe(80);
    });

    it('should create network error', () => {
      const error = NetworkErrors.networkError('Connection failed', { reason: 'timeout' });

      expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(error.message).toBe('Network error: Connection failed');
      expect(getErrorDetail(error, 'reason')).toBe('timeout');
    });
  });

  describe('EndpointErrors', () => {
    it('should create endpoint not found error', () => {
      const error = EndpointErrors.notFound('endpoint-1');

      expect(error.code).toBe(ErrorCode.ENDPOINT_NOT_FOUND);
      expect(error.message).toContain("Endpoint 'endpoint-1' not found");
      expect(getErrorDetail(error, 'endpointId')).toBe('endpoint-1');
    });

    it('should create endpoint already exists error', () => {
      const error = EndpointErrors.alreadyExists('endpoint-1', 8000);

      expect(error.code).toBe(ErrorCode.ENDPOINT_ALREADY_EXISTS);
      expect(error.message).toContain('endpoint already exists on port 8000');
      expect(getErrorDetail(error, 'endpointId')).toBe('endpoint-1');
      expect(getErrorDetail(error, 'port')).toBe(8000);
    });

    it('should create start failed error', () => {
      const error = EndpointErrors.startFailed('endpoint-1', 'Socket error');

      expect(error.code).toBe(ErrorCode.ENDPOINT_START_FAILED);
      expect(error.message).toContain("Failed to start endpoint 'endpoint-1': Socket error");
      expect(getErrorDetail(error, 'endpointId')).toBe('endpoint-1');
      expect(getErrorDetail(error, 'reason')).toBe('Socket error');
    });

    it('should create already active error', () => {
      const error = EndpointErrors.alreadyActive('endpoint-1');

      expect(error.code).toBe(ErrorCode.ENDPOINT_ALREADY_EXISTS);
      expect(error.message).toContain("Endpoint 'endpoint-1' is already active");
      expect(getErrorDetail(error, 'endpointId')).toBe('endpoint-1');
    });

    it('should create already stopped error', () => {
      const error = EndpointErrors.alreadyStopped('endpoint-1');

      expect(error.code).toBe(ErrorCode.ENDPOINT_NOT_FOUND);
      expect(error.message).toContain("Endpoint 'endpoint-1' is already stopped");
      expect(getErrorDetail(error, 'endpointId')).toBe('endpoint-1');
    });
  });

  describe('MessageErrors', () => {
    it('should create parse error', () => {
      const error = MessageErrors.parseError('Invalid format', { offset: 10 });

      expect(error.code).toBe(ErrorCode.MESSAGE_PARSE_ERROR);
      expect(error.message).toBe('Failed to parse OSC message: Invalid format');
      expect(getErrorDetail(error, 'offset')).toBe(10);
    });

    it('should create invalid message error', () => {
      const error = MessageErrors.invalidMessage('Missing address');

      expect(error.code).toBe(ErrorCode.INVALID_OSC_MESSAGE);
      expect(error.message).toBe('Invalid OSC message format: Missing address');
      expect(getErrorDetail(error, 'reason')).toBe('Missing address');
    });

    it('should create unsupported type error', () => {
      const error = MessageErrors.unsupportedType('x');

      expect(error.code).toBe(ErrorCode.MESSAGE_PARSE_ERROR);
      expect(error.message).toContain("Unsupported OSC type tag 'x'");
      expect(getErrorDetail(error, 'unsupportedType')).toBe('x');
      expect(getErrorDetail(error, 'supportedTypes')).toEqual(['i', 'f', 's', 'b']);
    });
  });

  describe('ValidationErrors', () => {
    it('should create missing parameter error', () => {
      const error = ValidationErrors.missingParameter('port');

      expect(error.code).toBe(ErrorCode.MISSING_REQUIRED_PARAMETER);
      expect(error.message).toBe("Missing required parameter: 'port'");
      expect(getErrorDetail(error, 'paramName')).toBe('port');
    });

    it('should create invalid parameter error', () => {
      const error = ValidationErrors.invalidParameter('port', 'abc', 'number');

      expect(error.code).toBe(ErrorCode.INVALID_PARAMETERS);
      expect(error.message).toContain("Invalid parameter 'port': expected number, got string");
      expect(getErrorDetail(error, 'paramName')).toBe('port');
      expect(getErrorDetail(error, 'providedValue')).toBe('abc');
      expect(getErrorDetail(error, 'expectedType')).toBe('number');
    });

    it('should create parameter out of range error', () => {
      const error = ValidationErrors.parameterOutOfRange('port', 100, 1024, 65535);

      expect(error.code).toBe(ErrorCode.INVALID_PARAMETERS);
      expect(error.message).toContain("Parameter 'port' value 100 is out of range");
      expect(getErrorDetail(error, 'paramName')).toBe('port');
      expect(getErrorDetail(error, 'value')).toBe(100);
      expect(getErrorDetail(error, 'validRange')).toEqual({ min: 1024, max: 65535 });
    });

    it('should create invalid address pattern error', () => {
      const error = ValidationErrors.invalidAddressPattern('invalid');

      expect(error.code).toBe(ErrorCode.INVALID_PARAMETERS);
      expect(error.message).toContain("Invalid OSC address pattern: 'invalid'");
      expect(getErrorDetail(error, 'pattern')).toBe('invalid');
    });
  });

  describe('OperationErrors', () => {
    it('should create internal error', () => {
      const error = OperationErrors.internalError('Database connection failed', { db: 'main' });

      expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(error.message).toBe('Internal error: Database connection failed');
      expect(getErrorDetail(error, 'db')).toBe('main');
    });

    it('should create operation failed error', () => {
      const error = OperationErrors.operationFailed('createEndpoint', 'Port unavailable');

      expect(error.code).toBe(ErrorCode.OPERATION_FAILED);
      expect(error.message).toBe("Operation 'createEndpoint' failed: Port unavailable");
      expect(getErrorDetail(error, 'operation')).toBe('createEndpoint');
      expect(getErrorDetail(error, 'reason')).toBe('Port unavailable');
    });
  });

  describe('ErrorUtils', () => {
    it('should convert Error to OSCError', () => {
      const originalError = new Error('Test error');
      const oscError = ErrorUtils.fromError(originalError);

      expect(oscError.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(oscError.message).toBe('Test error');
      expect(getErrorDetail(oscError, 'originalError')).toBe('Error');
    });

    it('should convert Error to OSCError with custom code', () => {
      const originalError = new Error('Network error');
      const oscError = ErrorUtils.fromError(originalError, ErrorCode.NETWORK_ERROR);

      expect(oscError.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(oscError.message).toBe('Network error');
    });

    it('should identify network errors', () => {
      const networkError = NetworkErrors.portInUse(8000);
      const otherError = ValidationErrors.missingParameter('port');

      expect(ErrorUtils.isNetworkError(networkError)).toBe(true);
      expect(ErrorUtils.isNetworkError(otherError)).toBe(false);
    });

    it('should identify recoverable errors', () => {
      const recoverableError = NetworkErrors.portInUse(8000);
      const nonRecoverableError = OperationErrors.internalError('System failure');

      expect(ErrorUtils.isRecoverable(recoverableError)).toBe(true);
      expect(ErrorUtils.isRecoverable(nonRecoverableError)).toBe(false);
    });

    it('should provide suggestions for port in use error', () => {
      const error = NetworkErrors.portInUse(8000, [8001, 8002]);
      const suggestions = ErrorUtils.getSuggestions(error);

      expect(suggestions).toContain('Try using a different port number');
      expect(suggestions.some(s => s.includes('8001, 8002'))).toBe(true);
    });

    it('should provide suggestions for invalid port error', () => {
      const error = NetworkErrors.portInvalid(100);
      const suggestions = ErrorUtils.getSuggestions(error);

      expect(suggestions).toContain('Use a port number between 1024 and 65535');
    });

    it('should provide suggestions for permission denied error', () => {
      const error = NetworkErrors.permissionDenied(80);
      const suggestions = ErrorUtils.getSuggestions(error);

      expect(suggestions).toContain('Use a port number above 1024');
      expect(suggestions).toContain('Run the application with appropriate privileges');
    });

    it('should provide suggestions for endpoint not found error', () => {
      const error = EndpointErrors.notFound('endpoint-1');
      const suggestions = ErrorUtils.getSuggestions(error);

      expect(suggestions).toContain('Check that the endpoint ID is correct');
      expect(suggestions).toContain('Use get_endpoint_status to see available endpoints');
    });
  });

  describe('formatErrorResponse', () => {
    it('should format error response with suggestions', () => {
      const error = NetworkErrors.portInUse(8000, [8001, 8002]);
      const response = formatErrorResponse(error);

      expect(response.error.code).toBe(ErrorCode.PORT_IN_USE);
      expect(response.error.message).toContain('Port 8000 is already in use');
      expect(response.error.details).toBeDefined();
      expect(response.error.suggestions).toBeDefined();
      expect(response.error.suggestions.length).toBeGreaterThan(0);
    });
  });
});
