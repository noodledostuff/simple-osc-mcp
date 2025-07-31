/**
 * OSC Message Parser
 *
 * Implements OSC 1.0 specification message parsing for extracting
 * address patterns, type tags, and arguments from raw OSC message bytes.
 */

import { OSCMessage, OSCArgument, OSCType, ErrorCode, OSCError } from '../types/index';

/**
 * Result of parsing an OSC message
 */
export interface ParseResult {
  /** Successfully parsed OSC message */
  message?: OSCMessage;
  /** Error information if parsing failed */
  error?: OSCError;
}

/**
 * Parses a raw OSC message buffer into structured data
 *
 * @param data Raw message bytes received from UDP socket
 * @param sourceIp IP address of the message sender
 * @param sourcePort Port number of the message sender
 * @returns ParseResult containing either parsed message or error
 */
export function parseOSCMessage(data: Buffer, sourceIp: string, sourcePort: number): ParseResult {
  try {
    // Validate minimum message size (address + type tags)
    if (data.length < 8) {
      return {
        error: {
          code: ErrorCode.INVALID_OSC_MESSAGE,
          message: 'OSC message too short (minimum 8 bytes required)',
          details: { messageLength: data.length },
        },
      };
    }

    let offset = 0;

    // Extract OSC address pattern
    const addressResult = extractAddressPattern(data, offset);
    if (addressResult.error) {
      return { error: addressResult.error };
    }
    const address = addressResult.value!;
    offset = addressResult.nextOffset!;

    // Extract type tags
    const typeTagsResult = extractTypeTags(data, offset);
    if (typeTagsResult.error) {
      return { error: typeTagsResult.error };
    }
    const typeTags = typeTagsResult.value!;
    offset = typeTagsResult.nextOffset!;

    // Extract arguments based on type tags
    const argumentsResult = extractArguments(data, offset, typeTags);
    if (argumentsResult.error) {
      return { error: argumentsResult.error };
    }
    const arguments_ = argumentsResult.value!;

    // Create parsed message
    const message: OSCMessage = {
      timestamp: new Date(),
      address,
      typeTags,
      arguments: arguments_,
      sourceIp,
      sourcePort,
    };

    return { message };
  } catch (error) {
    return {
      error: {
        code: ErrorCode.MESSAGE_PARSE_ERROR,
        message: `Failed to parse OSC message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { originalError: error },
      },
    };
  }
}

/**
 * Internal result type for extraction functions
 */
interface ExtractionResult<T> {
  value?: T;
  nextOffset?: number;
  error?: OSCError;
}

/**
 * Extracts OSC address pattern from message data
 *
 * @param data Message buffer
 * @param offset Starting offset in buffer
 * @returns Extraction result with address string and next offset
 */
export function extractAddressPattern(data: Buffer, offset: number): ExtractionResult<string> {
  try {
    // Find null terminator for address string
    const nullIndex = data.indexOf(0, offset);
    if (nullIndex === -1) {
      return {
        error: {
          code: ErrorCode.INVALID_OSC_MESSAGE,
          message: 'OSC address pattern not null-terminated',
        },
      };
    }

    // Extract address string
    const address = data.subarray(offset, nullIndex).toString('utf8');

    // Validate address starts with '/'
    if (!address.startsWith('/')) {
      return {
        error: {
          code: ErrorCode.INVALID_OSC_MESSAGE,
          message: 'OSC address pattern must start with "/"',
          details: { address },
        },
      };
    }

    // Calculate next offset (aligned to 4-byte boundary)
    const nextOffset = alignTo4Bytes(nullIndex + 1);

    return {
      value: address,
      nextOffset,
    };
  } catch (error) {
    return {
      error: {
        code: ErrorCode.MESSAGE_PARSE_ERROR,
        message: `Failed to extract address pattern: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    };
  }
}

/**
 * Extracts OSC type tags from message data
 *
 * @param data Message buffer
 * @param offset Starting offset in buffer
 * @returns Extraction result with type tags string and next offset
 */
export function extractTypeTags(data: Buffer, offset: number): ExtractionResult<string> {
  try {
    // Check if we have enough data
    if (offset >= data.length) {
      return {
        error: {
          code: ErrorCode.INVALID_OSC_MESSAGE,
          message: 'Insufficient data for type tags',
        },
      };
    }

    // Type tags must start with ','
    if (data[offset] !== 0x2c) {
      // ASCII comma
      return {
        error: {
          code: ErrorCode.INVALID_OSC_MESSAGE,
          message: 'OSC type tags must start with ","',
        },
      };
    }

    // Find null terminator for type tags
    const nullIndex = data.indexOf(0, offset);
    if (nullIndex === -1) {
      return {
        error: {
          code: ErrorCode.INVALID_OSC_MESSAGE,
          message: 'OSC type tags not null-terminated',
        },
      };
    }

    // Extract type tags (skip the leading comma)
    const typeTags = data.subarray(offset + 1, nullIndex).toString('utf8');

    // Calculate next offset (aligned to 4-byte boundary)
    const nextOffset = alignTo4Bytes(nullIndex + 1);

    return {
      value: typeTags,
      nextOffset,
    };
  } catch (error) {
    return {
      error: {
        code: ErrorCode.MESSAGE_PARSE_ERROR,
        message: `Failed to extract type tags: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    };
  }
}

/**
 * Extracts OSC arguments based on type tags
 *
 * @param data Message buffer
 * @param offset Starting offset in buffer
 * @param typeTags Type tags string indicating argument types
 * @returns Extraction result with arguments array
 */
export function extractArguments(
  data: Buffer,
  offset: number,
  typeTags: string
): ExtractionResult<OSCArgument[]> {
  try {
    const arguments_: OSCArgument[] = [];
    let currentOffset = offset;

    for (const typeTag of typeTags) {
      // Check if we have enough data remaining
      if (currentOffset >= data.length) {
        return {
          error: {
            code: ErrorCode.INVALID_OSC_MESSAGE,
            message: `Insufficient data for argument of type '${typeTag}'`,
          },
        };
      }

      switch (typeTag) {
        case OSCType.INT32:
          {
            if (currentOffset + 4 > data.length) {
              return {
                error: {
                  code: ErrorCode.INVALID_OSC_MESSAGE,
                  message: 'Insufficient data for int32 argument',
                },
              };
            }
            const value = data.readInt32BE(currentOffset);
            arguments_.push(value);
            currentOffset += 4;
          }
          break;

        case OSCType.FLOAT32:
          {
            if (currentOffset + 4 > data.length) {
              return {
                error: {
                  code: ErrorCode.INVALID_OSC_MESSAGE,
                  message: 'Insufficient data for float32 argument',
                },
              };
            }
            const value = data.readFloatBE(currentOffset);
            arguments_.push(value);
            currentOffset += 4;
          }
          break;

        case OSCType.STRING:
          {
            const nullIndex = data.indexOf(0, currentOffset);
            if (nullIndex === -1) {
              return {
                error: {
                  code: ErrorCode.INVALID_OSC_MESSAGE,
                  message: 'String argument not null-terminated',
                },
              };
            }
            const value = data.subarray(currentOffset, nullIndex).toString('utf8');
            arguments_.push(value);
            currentOffset = alignTo4Bytes(nullIndex + 1);
          }
          break;

        case OSCType.BLOB:
          {
            if (currentOffset + 4 > data.length) {
              return {
                error: {
                  code: ErrorCode.INVALID_OSC_MESSAGE,
                  message: 'Insufficient data for blob size',
                },
              };
            }
            const blobSize = data.readInt32BE(currentOffset);
            currentOffset += 4;

            if (currentOffset + blobSize > data.length) {
              return {
                error: {
                  code: ErrorCode.INVALID_OSC_MESSAGE,
                  message: 'Insufficient data for blob content',
                },
              };
            }

            const value = data.subarray(currentOffset, currentOffset + blobSize);
            arguments_.push(value);
            currentOffset = alignTo4Bytes(currentOffset + blobSize);
          }
          break;

        default:
          // Skip unsupported type tags but continue processing
          console.warn(`Unsupported OSC type tag '${typeTag}', skipping argument`);
          break;
      }
    }

    return {
      value: arguments_,
    };
  } catch (error) {
    return {
      error: {
        code: ErrorCode.MESSAGE_PARSE_ERROR,
        message: `Failed to extract arguments: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    };
  }
}

/**
 * Aligns an offset to the next 4-byte boundary as required by OSC specification
 *
 * @param offset Current offset
 * @returns Next 4-byte aligned offset
 */
function alignTo4Bytes(offset: number): number {
  return (offset + 3) & ~3;
}

/**
 * Validates if a buffer contains a potentially valid OSC message
 *
 * @param data Buffer to validate
 * @returns True if buffer might contain valid OSC message
 */
export function isValidOSCMessage(data: Buffer): boolean {
  // Basic validation: minimum size and starts with '/'
  return data.length >= 8 && data[0] === 0x2f; // ASCII '/'
}
