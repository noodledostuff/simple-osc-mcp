/**
 * OSC Message Buffer
 *
 * Implements a circular buffer for storing OSC messages with timestamps,
 * filtering capabilities, and efficient querying with time windows and limits.
 */

import { OSCMessage, MessageBufferConfig, MessageQuery } from '../types/index';

/**
 * Circular buffer for storing and managing OSC messages
 */
export class MessageBuffer {
  private messages: OSCMessage[] = [];
  private maxSize: number;
  private addressFilters: string[];
  private writeIndex: number = 0;
  private totalMessagesReceived: number = 0;

  /**
   * Creates a new message buffer
   *
   * @param config Buffer configuration
   */
  constructor(config: MessageBufferConfig) {
    this.maxSize = Math.max(1, config.maxSize); // Ensure at least size 1
    this.addressFilters = config.addressFilters || [];
  }

  /**
   * Adds a new message to the buffer
   *
   * @param message OSC message to store
   */
  addMessage(message: OSCMessage): void {
    // Apply address filters if configured
    if (this.addressFilters.length > 0) {
      const matchesFilter = this.addressFilters.some(filter =>
        this.matchesAddressPattern(message.address, filter)
      );
      if (!matchesFilter) {
        return; // Skip message if it doesn't match any filter
      }
    }

    // Add message to buffer (circular buffer behavior)
    if (this.messages.length < this.maxSize) {
      // Buffer not full yet, just append
      this.messages.push(message);
    } else {
      // Buffer is full, overwrite oldest message
      this.messages[this.writeIndex] = message;
      this.writeIndex = (this.writeIndex + 1) % this.maxSize;
    }

    this.totalMessagesReceived++;
  }

  /**
   * Queries messages from the buffer based on filter criteria
   *
   * @param query Query parameters for filtering messages
   * @returns Array of matching messages
   */
  getMessages(query: MessageQuery = {}): OSCMessage[] {
    let filteredMessages = [...this.messages];

    // Filter by address pattern if specified
    if (query.addressPattern !== undefined) {
      if (query.addressPattern === '') {
        // Empty pattern matches nothing
        return [];
      }
      filteredMessages = filteredMessages.filter(message =>
        this.matchesAddressPattern(message.address, query.addressPattern!)
      );
    }

    // Filter by time window if specified
    if (query.since) {
      filteredMessages = filteredMessages.filter(message => message.timestamp >= query.since!);
    }

    if (query.until) {
      filteredMessages = filteredMessages.filter(message => message.timestamp <= query.until!);
    }

    // Sort by timestamp (newest first)
    filteredMessages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply limit if specified
    if (query.limit !== undefined) {
      if (query.limit === 0) {
        return [];
      }
      if (query.limit > 0) {
        filteredMessages = filteredMessages.slice(0, query.limit);
      }
      // Negative limits are ignored (no filtering applied)
    }

    return filteredMessages;
  }

  /**
   * Gets messages within a time window from now
   *
   * @param timeWindowSeconds Number of seconds back from now
   * @param limit Optional limit on number of messages
   * @returns Array of messages within the time window
   */
  getRecentMessages(timeWindowSeconds: number, limit?: number): OSCMessage[] {
    const since = new Date(Date.now() - timeWindowSeconds * 1000);
    const query: MessageQuery = { since };
    if (limit !== undefined) {
      query.limit = limit;
    }
    return this.getMessages(query);
  }

  /**
   * Gets the total number of messages currently stored in the buffer
   *
   * @returns Number of messages in buffer
   */
  getMessageCount(): number {
    return this.messages.length;
  }

  /**
   * Gets the total number of messages received (including those that were overwritten)
   *
   * @returns Total messages received since buffer creation
   */
  getTotalMessagesReceived(): number {
    return this.totalMessagesReceived;
  }

  /**
   * Clears all messages from the buffer
   */
  clear(): void {
    this.messages = [];
    this.writeIndex = 0;
    this.totalMessagesReceived = 0;
  }

  /**
   * Updates the buffer configuration
   *
   * @param config New buffer configuration
   */
  updateConfig(config: Partial<MessageBufferConfig>): void {
    if (config.maxSize !== undefined) {
      this.resizeBuffer(config.maxSize);
    }

    if (config.addressFilters !== undefined) {
      this.addressFilters = config.addressFilters;
    }
  }

  /**
   * Gets the current buffer configuration
   *
   * @returns Current buffer configuration
   */
  getConfig(): MessageBufferConfig {
    return {
      maxSize: this.maxSize,
      addressFilters: [...this.addressFilters],
    };
  }

  /**
   * Resizes the buffer to a new maximum size
   *
   * @param newSize New maximum buffer size
   */
  private resizeBuffer(newSize: number): void {
    const newMaxSize = Math.max(1, newSize);

    if (newMaxSize >= this.messages.length) {
      // Growing buffer - no need to remove messages
      this.maxSize = newMaxSize;
      return;
    }

    // Shrinking buffer - keep newest messages
    const sortedMessages = [...this.messages].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

    this.messages = sortedMessages.slice(0, newMaxSize);
    this.maxSize = newMaxSize;
    this.writeIndex = 0;
  }

  /**
   * Checks if an OSC address matches a pattern with wildcard support
   *
   * @param address OSC address to test
   * @param pattern Pattern to match against (supports * and ? wildcards)
   * @returns True if address matches pattern
   */
  private matchesAddressPattern(address: string, pattern: string): boolean {
    // Convert OSC pattern to regex
    // * matches any sequence of characters
    // ? matches any single character
    // Escape other regex special characters
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
      .replace(/\*/g, '.*') // * becomes .*
      .replace(/\?/g, '.'); // ? becomes .

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(address);
  }
}

/**
 * Creates a new message buffer with the specified configuration
 *
 * @param config Buffer configuration
 * @returns New MessageBuffer instance
 */
export function createMessageBuffer(config: MessageBufferConfig): MessageBuffer {
  return new MessageBuffer(config);
}
