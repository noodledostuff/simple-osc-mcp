/**
 * Unit tests for OSC Message Parser
 *
 * Tests parsing of various OSC message formats according to OSC 1.0 specification
 */

import {
  parseOSCMessage,
  extractAddressPattern,
  extractTypeTags,
  extractArguments,
  isValidOSCMessage,
} from './parser';
import { ErrorCode } from '../types/index';

describe('OSC Message Parser', () => {
  describe('parseOSCMessage', () => {
    it('should parse a simple message with no arguments', () => {
      // Create OSC message: "/test" with no arguments
      const buffer = Buffer.alloc(12);
      let offset = 0;

      // Address: "/test" (5 bytes + null + 2 padding = 8 bytes)
      buffer.write('/test', offset);
      buffer.writeUInt8(0, offset + 5); // null terminator
      offset += 8;

      // Type tags: "," (1 byte + null + 2 padding = 4 bytes)
      buffer.write(',', offset);
      buffer.writeUInt8(0, offset + 1); // null terminator

      const result = parseOSCMessage(buffer, '127.0.0.1', 8000);

      expect(result.error).toBeUndefined();
      expect(result.message).toBeDefined();
      expect(result.message!.address).toBe('/test');
      expect(result.message!.typeTags).toBe('');
      expect(result.message!.arguments).toEqual([]);
      expect(result.message!.sourceIp).toBe('127.0.0.1');
      expect(result.message!.sourcePort).toBe(8000);
    });

    it('should parse a message with integer argument', () => {
      // Create OSC message: "/synth/freq" with int32 argument 440
      const buffer = Buffer.alloc(20);
      let offset = 0;

      // Address: "/synth/freq" (11 bytes + null = 12 bytes, already 4-byte aligned)
      buffer.write('/synth/freq', offset);
      buffer.writeUInt8(0, offset + 11); // null terminator
      offset = 12; // Already 4-byte aligned

      // Type tags: ",i" (2 bytes + null + 1 padding = 4 bytes)
      buffer.write(',i', offset);
      buffer.writeUInt8(0, offset + 2); // null terminator
      offset = 16; // Move to next 4-byte boundary

      // Argument: int32 440
      buffer.writeInt32BE(440, offset);

      const result = parseOSCMessage(buffer, '192.168.1.100', 57120);

      expect(result.error).toBeUndefined();
      expect(result.message).toBeDefined();
      expect(result.message!.address).toBe('/synth/freq');
      expect(result.message!.typeTags).toBe('i');
      expect(result.message!.arguments).toEqual([440]);
    });

    it('should parse a message with float argument', () => {
      // Create OSC message: "/volume" with float32 argument 0.75
      const buffer = Buffer.alloc(16);
      let offset = 0;

      // Address: "/volume" (7 bytes + null = 8 bytes)
      buffer.write('/volume', offset);
      buffer.writeUInt8(0, offset + 7); // null terminator
      offset += 8;

      // Type tags: ",f" (2 bytes + null + 1 padding = 4 bytes)
      buffer.write(',f', offset);
      buffer.writeUInt8(0, offset + 2); // null terminator
      offset += 4;

      // Argument: float32 0.75
      buffer.writeFloatBE(0.75, offset);

      const result = parseOSCMessage(buffer, '127.0.0.1', 8000);

      expect(result.error).toBeUndefined();
      expect(result.message).toBeDefined();
      expect(result.message!.address).toBe('/volume');
      expect(result.message!.typeTags).toBe('f');
      expect(result.message!.arguments).toEqual([0.75]);
    });

    it('should parse a message with string argument', () => {
      // Create OSC message: "/name" with string argument "test"
      const buffer = Buffer.alloc(20);
      let offset = 0;

      // Address: "/name" (5 bytes + null + 2 padding = 8 bytes)
      buffer.write('/name', offset);
      buffer.writeUInt8(0, offset + 5); // null terminator
      offset += 8;

      // Type tags: ",s" (2 bytes + null + 1 padding = 4 bytes)
      buffer.write(',s', offset);
      buffer.writeUInt8(0, offset + 2); // null terminator
      offset += 4;

      // Argument: string "test" (4 bytes + null + 3 padding = 8 bytes)
      buffer.write('test', offset);
      buffer.writeUInt8(0, offset + 4); // null terminator

      const result = parseOSCMessage(buffer, '127.0.0.1', 8000);

      expect(result.error).toBeUndefined();
      expect(result.message).toBeDefined();
      expect(result.message!.address).toBe('/name');
      expect(result.message!.typeTags).toBe('s');
      expect(result.message!.arguments).toEqual(['test']);
    });

    it('should parse a message with blob argument', () => {
      // Create OSC message: "/data" with blob argument
      const blobData = Buffer.from([0x01, 0x02, 0x03, 0x04]);
      const buffer = Buffer.alloc(20);
      let offset = 0;

      // Address: "/data" (5 bytes + null + 2 padding = 8 bytes)
      buffer.write('/data', offset);
      buffer.writeUInt8(0, offset + 5); // null terminator
      offset += 8;

      // Type tags: ",b" (2 bytes + null + 1 padding = 4 bytes)
      buffer.write(',b', offset);
      buffer.writeUInt8(0, offset + 2); // null terminator
      offset += 4;

      // Argument: blob size (4 bytes) + data (4 bytes)
      buffer.writeInt32BE(4, offset);
      offset += 4;
      blobData.copy(buffer, offset);

      const result = parseOSCMessage(buffer, '127.0.0.1', 8000);

      expect(result.error).toBeUndefined();
      expect(result.message).toBeDefined();
      expect(result.message!.address).toBe('/data');
      expect(result.message!.typeTags).toBe('b');
      expect(result.message!.arguments).toHaveLength(1);
      expect(Buffer.isBuffer(result.message!.arguments[0])).toBe(true);
      expect(result.message!.arguments[0]).toEqual(blobData);
    });

    it('should parse a message with multiple arguments', () => {
      // Create OSC message: "/multi" with int, float, string arguments
      const buffer = Buffer.alloc(28);
      let offset = 0;

      // Address: "/multi" (6 bytes + null + 1 padding = 8 bytes)
      buffer.write('/multi', offset);
      buffer.writeUInt8(0, offset + 6); // null terminator
      offset += 8;

      // Type tags: ",ifs" (4 bytes + null + 3 padding = 8 bytes)
      buffer.write(',ifs', offset);
      buffer.writeUInt8(0, offset + 4); // null terminator
      offset += 8;

      // Arguments: int32 123, float32 4.56, string "hi"
      buffer.writeInt32BE(123, offset);
      offset += 4;
      buffer.writeFloatBE(4.56, offset);
      offset += 4;
      buffer.write('hi', offset);
      buffer.writeUInt8(0, offset + 2); // null terminator for string

      const result = parseOSCMessage(buffer, '127.0.0.1', 8000);

      expect(result.error).toBeUndefined();
      expect(result.message).toBeDefined();
      expect(result.message!.address).toBe('/multi');
      expect(result.message!.typeTags).toBe('ifs');
      expect(result.message!.arguments).toHaveLength(3);
      expect(result.message!.arguments[0]).toBe(123);
      expect(result.message!.arguments[1]).toBeCloseTo(4.56);
      expect(result.message!.arguments[2]).toBe('hi');
    });

    it('should handle unsupported type tags gracefully', () => {
      // Create OSC message with unsupported type tag 'x'
      const buffer = Buffer.alloc(16);
      let offset = 0;

      // Address: "/test" (5 bytes + null + 2 padding = 8 bytes)
      buffer.write('/test', offset);
      buffer.writeUInt8(0, offset + 5); // null terminator
      offset += 8;

      // Type tags: ",xi" (3 bytes + null = 4 bytes)
      buffer.write(',xi', offset);
      buffer.writeUInt8(0, offset + 3); // null terminator
      offset += 4;

      // Argument: int32 42 (the 'x' type will be skipped)
      buffer.writeInt32BE(42, offset);

      const result = parseOSCMessage(buffer, '127.0.0.1', 8000);

      expect(result.error).toBeUndefined();
      expect(result.message).toBeDefined();
      expect(result.message!.address).toBe('/test');
      expect(result.message!.typeTags).toBe('xi');
      expect(result.message!.arguments).toEqual([42]); // Only the int argument
    });

    it('should return error for message too short', () => {
      const buffer = Buffer.alloc(4);
      buffer.write('/hi');

      const result = parseOSCMessage(buffer, '127.0.0.1', 8000);

      expect(result.message).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe(ErrorCode.INVALID_OSC_MESSAGE);
      expect(result.error!.message).toContain('too short');
    });

    it('should return error for invalid address pattern', () => {
      const buffer = Buffer.alloc(12);
      let offset = 0;

      // Invalid address: "test" (doesn't start with '/')
      buffer.write('test', offset);
      buffer.writeUInt8(0, offset + 4); // null terminator
      offset += 8;

      // Type tags: ","
      buffer.write(',', offset);
      buffer.writeUInt8(0, offset + 1); // null terminator

      const result = parseOSCMessage(buffer, '127.0.0.1', 8000);

      expect(result.message).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe(ErrorCode.INVALID_OSC_MESSAGE);
      expect(result.error!.message).toContain('must start with "/"');
    });

    it('should return error for missing type tags', () => {
      const buffer = Buffer.alloc(8);
      buffer.write('/test');
      // No type tags section

      const result = parseOSCMessage(buffer, '127.0.0.1', 8000);

      expect(result.message).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe(ErrorCode.INVALID_OSC_MESSAGE);
    });
  });

  describe('extractAddressPattern', () => {
    it('should extract valid address pattern', () => {
      const buffer = Buffer.alloc(8);
      buffer.write('/test');
      buffer.writeUInt8(0, 5); // null terminator

      const result = extractAddressPattern(buffer, 0);

      expect(result.error).toBeUndefined();
      expect(result.value).toBe('/test');
      expect(result.nextOffset).toBe(8);
    });

    it('should return error for address not starting with /', () => {
      const buffer = Buffer.alloc(8);
      buffer.write('test');
      buffer.writeUInt8(0, 4); // null terminator

      const result = extractAddressPattern(buffer, 0);

      expect(result.value).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe(ErrorCode.INVALID_OSC_MESSAGE);
    });

    it('should return error for non-null-terminated address', () => {
      const buffer = Buffer.alloc(8);
      buffer.fill(0x2f); // Fill with '/' characters, no null terminator

      const result = extractAddressPattern(buffer, 0);

      expect(result.value).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe(ErrorCode.INVALID_OSC_MESSAGE);
    });
  });

  describe('extractTypeTags', () => {
    it('should extract valid type tags', () => {
      const buffer = Buffer.alloc(8);
      buffer.write(',ifs');
      buffer.writeUInt8(0, 4); // null terminator

      const result = extractTypeTags(buffer, 0);

      expect(result.error).toBeUndefined();
      expect(result.value).toBe('ifs');
      expect(result.nextOffset).toBe(8);
    });

    it('should return error for type tags not starting with comma', () => {
      const buffer = Buffer.alloc(8);
      buffer.write('ifs');
      buffer.writeUInt8(0, 3); // null terminator

      const result = extractTypeTags(buffer, 0);

      expect(result.value).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe(ErrorCode.INVALID_OSC_MESSAGE);
    });

    it('should return error for non-null-terminated type tags', () => {
      const buffer = Buffer.alloc(8);
      buffer.fill(0x2c); // Fill with ',' characters, no null terminator

      const result = extractTypeTags(buffer, 0);

      expect(result.value).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe(ErrorCode.INVALID_OSC_MESSAGE);
    });

    it('should handle empty type tags', () => {
      const buffer = Buffer.alloc(4);
      buffer.write(',');
      buffer.writeUInt8(0, 1); // null terminator

      const result = extractTypeTags(buffer, 0);

      expect(result.error).toBeUndefined();
      expect(result.value).toBe('');
      expect(result.nextOffset).toBe(4);
    });
  });

  describe('extractArguments', () => {
    it('should extract integer arguments', () => {
      const buffer = Buffer.alloc(8);
      buffer.writeInt32BE(123, 0);
      buffer.writeInt32BE(456, 4);

      const result = extractArguments(buffer, 0, 'ii');

      expect(result.error).toBeUndefined();
      expect(result.value).toEqual([123, 456]);
    });

    it('should extract float arguments', () => {
      const buffer = Buffer.alloc(8);
      buffer.writeFloatBE(1.23, 0);
      buffer.writeFloatBE(4.56, 4);

      const result = extractArguments(buffer, 0, 'ff');

      expect(result.error).toBeUndefined();
      expect(result.value).toHaveLength(2);
      expect(result.value![0]).toBeCloseTo(1.23);
      expect(result.value![1]).toBeCloseTo(4.56);
    });

    it('should extract string arguments', () => {
      const buffer = Buffer.alloc(12);
      let offset = 0;

      // String "hi" (2 bytes + null + 1 padding = 4 bytes)
      buffer.write('hi', offset);
      buffer.writeUInt8(0, offset + 2); // null terminator
      offset += 4;

      // String "test" (4 bytes + null + 3 padding = 8 bytes)
      buffer.write('test', offset);
      buffer.writeUInt8(0, offset + 4); // null terminator

      const result = extractArguments(buffer, 0, 'ss');

      expect(result.error).toBeUndefined();
      expect(result.value).toEqual(['hi', 'test']);
    });

    it('should extract blob arguments', () => {
      const buffer = Buffer.alloc(12);
      let offset = 0;

      // Blob size: 4
      buffer.writeInt32BE(4, offset);
      offset += 4;

      // Blob data: [1, 2, 3, 4]
      buffer.writeUInt8(1, offset++);
      buffer.writeUInt8(2, offset++);
      buffer.writeUInt8(3, offset++);
      buffer.writeUInt8(4, offset++);

      const result = extractArguments(buffer, 0, 'b');

      expect(result.error).toBeUndefined();
      expect(result.value).toHaveLength(1);
      expect(Buffer.isBuffer(result.value![0])).toBe(true);
      expect(result.value![0]).toEqual(Buffer.from([1, 2, 3, 4]));
    });

    it('should return error for insufficient data', () => {
      const buffer = Buffer.alloc(2);

      const result = extractArguments(buffer, 0, 'i');

      expect(result.value).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe(ErrorCode.INVALID_OSC_MESSAGE);
    });

    it('should handle mixed argument types', () => {
      const buffer = Buffer.alloc(16);
      let offset = 0;

      // int32: 42
      buffer.writeInt32BE(42, offset);
      offset += 4;

      // float32: 3.14
      buffer.writeFloatBE(3.14, offset);
      offset += 4;

      // string: "hi" (2 bytes + null + 1 padding = 4 bytes)
      buffer.write('hi', offset);
      buffer.writeUInt8(0, offset + 2); // null terminator
      offset += 4;

      const result = extractArguments(buffer, 0, 'ifs');

      expect(result.error).toBeUndefined();
      expect(result.value).toHaveLength(3);
      expect(result.value![0]).toBe(42);
      expect(result.value![1]).toBeCloseTo(3.14);
      expect(result.value![2]).toBe('hi');
    });
  });

  describe('isValidOSCMessage', () => {
    it('should return true for potentially valid OSC message', () => {
      const buffer = Buffer.alloc(12);
      buffer.write('/test');
      buffer.writeUInt8(0, 5); // null terminator
      buffer.write(',', 8);
      buffer.writeUInt8(0, 9); // null terminator

      expect(isValidOSCMessage(buffer)).toBe(true);
    });

    it('should return false for message too short', () => {
      const buffer = Buffer.alloc(4);
      buffer.write('/hi');

      expect(isValidOSCMessage(buffer)).toBe(false);
    });

    it('should return false for message not starting with /', () => {
      const buffer = Buffer.alloc(12);
      buffer.write('test');

      expect(isValidOSCMessage(buffer)).toBe(false);
    });
  });
});
