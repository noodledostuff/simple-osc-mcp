/**
 * Unit tests for parameter validation
 */

import {
  validatePort,
  validateBufferSize,
  validateAddressPattern,
  validateAddressFilters,
  validateEndpointId,
  validateTimeWindow,
  validateLimit,
  ParameterValidator
} from './validation';
import { ErrorCode } from '../types/index';

describe('Parameter Validation', () => {
  describe('validatePort', () => {
    it('should accept valid ports', () => {
      expect(validatePort(1024).isValid).toBe(true);
      expect(validatePort(8000).isValid).toBe(true);
      expect(validatePort(65535).isValid).toBe(true);
    });

    it('should reject undefined/null ports', () => {
      const result1 = validatePort(undefined);
      const result2 = validatePort(null);
      
      expect(result1.isValid).toBe(false);
      expect(result1.error?.code).toBe(ErrorCode.MISSING_REQUIRED_PARAMETER);
      expect(result2.isValid).toBe(false);
      expect(result2.error?.code).toBe(ErrorCode.MISSING_REQUIRED_PARAMETER);
    });

    it('should reject non-integer ports', () => {
      const result1 = validatePort('8000');
      const result2 = validatePort(8000.5);
      
      expect(result1.isValid).toBe(false);
      expect(result1.error?.code).toBe(ErrorCode.INVALID_PARAMETERS);
      expect(result2.isValid).toBe(false);
      expect(result2.error?.code).toBe(ErrorCode.INVALID_PARAMETERS);
    });

    it('should reject ports out of range', () => {
      const result1 = validatePort(1023);
      const result2 = validatePort(65536);
      
      expect(result1.isValid).toBe(false);
      expect(result1.error?.code).toBe(ErrorCode.INVALID_PARAMETERS);
      expect(result2.isValid).toBe(false);
      expect(result2.error?.code).toBe(ErrorCode.INVALID_PARAMETERS);
    });
  });

  describe('validateBufferSize', () => {
    it('should accept valid buffer sizes', () => {
      expect(validateBufferSize(1).isValid).toBe(true);
      expect(validateBufferSize(1000).isValid).toBe(true);
      expect(validateBufferSize(10000).isValid).toBe(true);
    });

    it('should accept undefined buffer size (optional)', () => {
      expect(validateBufferSize(undefined).isValid).toBe(true);
      expect(validateBufferSize(null).isValid).toBe(true);
    });

    it('should reject non-integer buffer sizes', () => {
      const result1 = validateBufferSize('1000');
      const result2 = validateBufferSize(1000.5);
      
      expect(result1.isValid).toBe(false);
      expect(result1.error?.code).toBe(ErrorCode.INVALID_PARAMETERS);
      expect(result2.isValid).toBe(false);
      expect(result2.error?.code).toBe(ErrorCode.INVALID_PARAMETERS);
    });

    it('should reject buffer sizes out of range', () => {
      const result1 = validateBufferSize(0);
      const result2 = validateBufferSize(10001);
      
      expect(result1.isValid).toBe(false);
      expect(result1.error?.code).toBe(ErrorCode.INVALID_PARAMETERS);
      expect(result2.isValid).toBe(false);
      expect(result2.error?.code).toBe(ErrorCode.INVALID_PARAMETERS);
    });
  });

  describe('validateAddressPattern', () => {
    it('should accept valid address patterns', () => {
      expect(validateAddressPattern('/test').isValid).toBe(true);
      expect(validateAddressPattern('/synth/freq').isValid).toBe(true);
      expect(validateAddressPattern('/osc/*/param').isValid).toBe(true);
    });

    it('should reject patterns not starting with /', () => {
      const result = validateAddressPattern('test');
      
      expect(result.isValid).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.INVALID_PARAMETERS);
    });

    it('should reject patterns with invalid characters', () => {
      const result1 = validateAddressPattern('/test<invalid>');
      const result2 = validateAddressPattern('/test"invalid"');
      
      expect(result1.isValid).toBe(false);
      expect(result1.error?.code).toBe(ErrorCode.INVALID_PARAMETERS);
      expect(result2.isValid).toBe(false);
      expect(result2.error?.code).toBe(ErrorCode.INVALID_PARAMETERS);
    });
  });

  describe('validateAddressFilters', () => {
    it('should accept valid address filter arrays', () => {
      expect(validateAddressFilters(['/test', '/synth/*']).isValid).toBe(true);
      expect(validateAddressFilters([]).isValid).toBe(true);
    });

    it('should accept undefined filters (optional)', () => {
      expect(validateAddressFilters(undefined).isValid).toBe(true);
      expect(validateAddressFilters(null).isValid).toBe(true);
    });

    it('should reject non-array filters', () => {
      const result = validateAddressFilters('/test');
      
      expect(result.isValid).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.INVALID_PARAMETERS);
    });

    it('should reject arrays with non-string elements', () => {
      const result = validateAddressFilters(['/test', 123]);
      
      expect(result.isValid).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.INVALID_PARAMETERS);
    });

    it('should reject arrays with invalid address patterns', () => {
      const result = validateAddressFilters(['/test', 'invalid']);
      
      expect(result.isValid).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.INVALID_PARAMETERS);
    });
  });

  describe('validateEndpointId', () => {
    it('should accept valid endpoint IDs', () => {
      expect(validateEndpointId('endpoint-1').isValid).toBe(true);
      expect(validateEndpointId('test-endpoint').isValid).toBe(true);
    });

    it('should reject undefined/null/empty endpoint IDs', () => {
      const result1 = validateEndpointId(undefined);
      const result2 = validateEndpointId(null);
      const result3 = validateEndpointId('');
      
      expect(result1.isValid).toBe(false);
      expect(result1.error?.code).toBe(ErrorCode.MISSING_REQUIRED_PARAMETER);
      expect(result2.isValid).toBe(false);
      expect(result2.error?.code).toBe(ErrorCode.MISSING_REQUIRED_PARAMETER);
      expect(result3.isValid).toBe(false);
      expect(result3.error?.code).toBe(ErrorCode.MISSING_REQUIRED_PARAMETER);
    });

    it('should reject non-string endpoint IDs', () => {
      const result = validateEndpointId(123);
      
      expect(result.isValid).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.INVALID_PARAMETERS);
    });

    it('should reject whitespace-only endpoint IDs', () => {
      const result = validateEndpointId('   ');
      
      expect(result.isValid).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.INVALID_PARAMETERS);
    });
  });

  describe('validateTimeWindow', () => {
    it('should accept valid time windows', () => {
      expect(validateTimeWindow(1).isValid).toBe(true);
      expect(validateTimeWindow(3600).isValid).toBe(true);
      expect(validateTimeWindow(86400).isValid).toBe(true);
    });

    it('should accept undefined time window (optional)', () => {
      expect(validateTimeWindow(undefined).isValid).toBe(true);
      expect(validateTimeWindow(null).isValid).toBe(true);
    });

    it('should reject non-number time windows', () => {
      const result = validateTimeWindow('3600');
      
      expect(result.isValid).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.INVALID_PARAMETERS);
    });

    it('should reject time windows out of range', () => {
      const result1 = validateTimeWindow(0);
      const result2 = validateTimeWindow(86401);
      
      expect(result1.isValid).toBe(false);
      expect(result1.error?.code).toBe(ErrorCode.INVALID_PARAMETERS);
      expect(result2.isValid).toBe(false);
      expect(result2.error?.code).toBe(ErrorCode.INVALID_PARAMETERS);
    });
  });

  describe('validateLimit', () => {
    it('should accept valid limits', () => {
      expect(validateLimit(1).isValid).toBe(true);
      expect(validateLimit(100).isValid).toBe(true);
      expect(validateLimit(1000).isValid).toBe(true);
    });

    it('should accept undefined limit (optional)', () => {
      expect(validateLimit(undefined).isValid).toBe(true);
      expect(validateLimit(null).isValid).toBe(true);
    });

    it('should reject non-integer limits', () => {
      const result1 = validateLimit('100');
      const result2 = validateLimit(100.5);
      
      expect(result1.isValid).toBe(false);
      expect(result1.error?.code).toBe(ErrorCode.INVALID_PARAMETERS);
      expect(result2.isValid).toBe(false);
      expect(result2.error?.code).toBe(ErrorCode.INVALID_PARAMETERS);
    });

    it('should reject limits out of range', () => {
      const result1 = validateLimit(0);
      const result2 = validateLimit(1001);
      
      expect(result1.isValid).toBe(false);
      expect(result1.error?.code).toBe(ErrorCode.INVALID_PARAMETERS);
      expect(result2.isValid).toBe(false);
      expect(result2.error?.code).toBe(ErrorCode.INVALID_PARAMETERS);
    });
  });

  describe('ParameterValidator', () => {
    describe('validateCreateEndpoint', () => {
      it('should accept valid create endpoint parameters', () => {
        const params = {
          port: 8000,
          bufferSize: 1000,
          addressFilters: ['/test', '/synth/*']
        };
        
        expect(ParameterValidator.validateCreateEndpoint(params).isValid).toBe(true);
      });

      it('should accept minimal valid parameters', () => {
        const params = { port: 8000 };
        
        expect(ParameterValidator.validateCreateEndpoint(params).isValid).toBe(true);
      });

      it('should reject non-object parameters', () => {
        const result = ParameterValidator.validateCreateEndpoint('invalid');
        
        expect(result.isValid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.INVALID_PARAMETERS);
      });

      it('should reject parameters with invalid port', () => {
        const params = { port: 100 };
        const result = ParameterValidator.validateCreateEndpoint(params);
        
        expect(result.isValid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.INVALID_PARAMETERS);
      });

      it('should reject parameters with invalid buffer size', () => {
        const params = { port: 8000, bufferSize: 0 };
        const result = ParameterValidator.validateCreateEndpoint(params);
        
        expect(result.isValid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.INVALID_PARAMETERS);
      });

      it('should reject parameters with invalid address filters', () => {
        const params = { port: 8000, addressFilters: ['invalid'] };
        const result = ParameterValidator.validateCreateEndpoint(params);
        
        expect(result.isValid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.INVALID_PARAMETERS);
      });
    });

    describe('validateStopEndpoint', () => {
      it('should accept valid stop endpoint parameters', () => {
        const params = { endpointId: 'endpoint-1' };
        
        expect(ParameterValidator.validateStopEndpoint(params).isValid).toBe(true);
      });

      it('should reject parameters without endpoint ID', () => {
        const params = {};
        const result = ParameterValidator.validateStopEndpoint(params);
        
        expect(result.isValid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.MISSING_REQUIRED_PARAMETER);
      });
    });

    describe('validateGetMessages', () => {
      it('should accept valid get messages parameters', () => {
        const params = {
          endpointId: 'endpoint-1',
          addressPattern: '/test',
          timeWindowSeconds: 3600,
          limit: 100
        };
        
        expect(ParameterValidator.validateGetMessages(params).isValid).toBe(true);
      });

      it('should accept empty parameters', () => {
        const params = {};
        
        expect(ParameterValidator.validateGetMessages(params).isValid).toBe(true);
      });

      it('should reject parameters with invalid address pattern', () => {
        const params = { addressPattern: 'invalid' };
        const result = ParameterValidator.validateGetMessages(params);
        
        expect(result.isValid).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.INVALID_PARAMETERS);
      });
    });

    describe('validateGetEndpointStatus', () => {
      it('should accept valid get endpoint status parameters', () => {
        const params = { endpointId: 'endpoint-1' };
        
        expect(ParameterValidator.validateGetEndpointStatus(params).isValid).toBe(true);
      });

      it('should accept empty parameters', () => {
        const params = {};
        
        expect(ParameterValidator.validateGetEndpointStatus(params).isValid).toBe(true);
      });
    });
  });
});