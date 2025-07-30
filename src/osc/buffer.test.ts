/**
 * Unit tests for OSC Message Buffer
 */

import { MessageBuffer, createMessageBuffer } from './buffer';
import { OSCMessage, MessageBufferConfig } from '../types/index';

// Helper function to create test OSC messages
function createTestMessage(
  address: string,
  timestamp: Date = new Date(),
  args: any[] = [],
  sourceIp: string = '127.0.0.1',
  sourcePort: number = 57120
): OSCMessage {
  return {
    timestamp,
    address,
    typeTags: 'f'.repeat(args.length),
    arguments: args,
    sourceIp,
    sourcePort
  };
}

describe('MessageBuffer', () => {
  let buffer: MessageBuffer;
  let config: MessageBufferConfig;

  beforeEach(() => {
    config = {
      maxSize: 5,
      addressFilters: []
    };
    buffer = new MessageBuffer(config);
  });

  describe('constructor', () => {
    it('should create buffer with correct configuration', () => {
      const bufferConfig = buffer.getConfig();
      expect(bufferConfig.maxSize).toBe(5);
      expect(bufferConfig.addressFilters).toEqual([]);
    });

    it('should ensure minimum buffer size of 1', () => {
      const smallBuffer = new MessageBuffer({ maxSize: 0, addressFilters: [] });
      expect(smallBuffer.getConfig().maxSize).toBe(1);
    });
  });

  describe('addMessage', () => {
    it('should add messages to buffer', () => {
      const message = createTestMessage('/test');
      buffer.addMessage(message);
      
      expect(buffer.getMessageCount()).toBe(1);
      expect(buffer.getTotalMessagesReceived()).toBe(1);
    });

    it('should handle buffer overflow by removing oldest messages', () => {
      // Fill buffer to capacity
      for (let i = 0; i < 5; i++) {
        buffer.addMessage(createTestMessage(`/test${i}`));
      }
      expect(buffer.getMessageCount()).toBe(5);

      // Add one more message (should overflow)
      const overflowMessage = createTestMessage('/overflow');
      buffer.addMessage(overflowMessage);
      
      expect(buffer.getMessageCount()).toBe(5); // Still at max capacity
      expect(buffer.getTotalMessagesReceived()).toBe(6); // But total count increased
      
      // Check that newest message is in buffer
      const messages = buffer.getMessages();
      expect(messages.some(m => m.address === '/overflow')).toBe(true);
    });

    it('should apply address filters when configured', () => {
      const filteredBuffer = new MessageBuffer({
        maxSize: 10,
        addressFilters: ['/synth/*', '/drum/*']
      });

      // These should be added
      filteredBuffer.addMessage(createTestMessage('/synth/freq'));
      filteredBuffer.addMessage(createTestMessage('/drum/kick'));
      
      // This should be filtered out
      filteredBuffer.addMessage(createTestMessage('/other/param'));

      expect(filteredBuffer.getMessageCount()).toBe(2);
      expect(filteredBuffer.getTotalMessagesReceived()).toBe(2);
    });
  });

  describe('getMessages', () => {
    beforeEach(() => {
      // Add test messages with different timestamps
      const now = new Date();
      buffer.addMessage(createTestMessage('/test1', new Date(now.getTime() - 3000))); // 3 seconds ago
      buffer.addMessage(createTestMessage('/test2', new Date(now.getTime() - 2000))); // 2 seconds ago
      buffer.addMessage(createTestMessage('/other', new Date(now.getTime() - 1000))); // 1 second ago
      buffer.addMessage(createTestMessage('/test3', now)); // now
    });

    it('should return all messages when no query specified', () => {
      const messages = buffer.getMessages();
      expect(messages).toHaveLength(4);
    });

    it('should return messages sorted by timestamp (newest first)', () => {
      const messages = buffer.getMessages();
      expect(messages).toHaveLength(4);
      expect(messages[0]?.address).toBe('/test3'); // newest
      expect(messages[3]?.address).toBe('/test1'); // oldest
    });

    it('should filter by address pattern', () => {
      const messages = buffer.getMessages({ addressPattern: '/test*' });
      expect(messages).toHaveLength(3);
      expect(messages.every(m => m.address.startsWith('/test'))).toBe(true);
    });

    it('should filter by time window (since)', () => {
      const since = new Date(Date.now() - 1500); // 1.5 seconds ago
      const messages = buffer.getMessages({ since });
      expect(messages).toHaveLength(2); // Should get /other and /test3
    });

    it('should filter by time window (until)', () => {
      const until = new Date(Date.now() - 1500); // 1.5 seconds ago
      const messages = buffer.getMessages({ until });
      expect(messages).toHaveLength(2); // Should get /test1 and /test2
    });

    it('should apply limit to results', () => {
      const messages = buffer.getMessages({ limit: 2 });
      expect(messages).toHaveLength(2);
      expect(messages[0]?.address).toBe('/test3'); // newest first
      expect(messages[1]?.address).toBe('/other');
    });

    it('should combine multiple filters', () => {
      const since = new Date(Date.now() - 2500); // 2.5 seconds ago
      const messages = buffer.getMessages({
        addressPattern: '/test*',
        since,
        limit: 1
      });
      expect(messages).toHaveLength(1);
      expect(messages[0]?.address).toBe('/test3');
    });
  });

  describe('getRecentMessages', () => {
    beforeEach(() => {
      const now = new Date();
      buffer.addMessage(createTestMessage('/old', new Date(now.getTime() - 5000))); // 5 seconds ago
      buffer.addMessage(createTestMessage('/recent1', new Date(now.getTime() - 1000))); // 1 second ago
      buffer.addMessage(createTestMessage('/recent2', now)); // now
    });

    it('should return messages within time window', () => {
      const messages = buffer.getRecentMessages(2); // Last 2 seconds
      expect(messages).toHaveLength(2);
      expect(messages.every(m => m.address.includes('recent'))).toBe(true);
    });

    it('should apply limit to recent messages', () => {
      const messages = buffer.getRecentMessages(10, 1); // Last 10 seconds, limit 1
      expect(messages).toHaveLength(1);
      expect(messages[0]?.address).toBe('/recent2'); // newest
    });
  });

  describe('address pattern matching', () => {
    beforeEach(() => {
      buffer.addMessage(createTestMessage('/synth/freq'));
      buffer.addMessage(createTestMessage('/synth/amp'));
      buffer.addMessage(createTestMessage('/drum/kick'));
      buffer.addMessage(createTestMessage('/drum/snare'));
      buffer.addMessage(createTestMessage('/fx/reverb/room'));
    });

    it('should match wildcard patterns', () => {
      const synthMessages = buffer.getMessages({ addressPattern: '/synth/*' });
      expect(synthMessages).toHaveLength(2);
      expect(synthMessages.every(m => m.address.startsWith('/synth/'))).toBe(true);
    });

    it('should match single character wildcards', () => {
      const messages = buffer.getMessages({ addressPattern: '/drum/????' });
      expect(messages).toHaveLength(1);
      expect(messages[0]?.address).toBe('/drum/kick');
    });

    it('should match complex patterns', () => {
      const messages = buffer.getMessages({ addressPattern: '/*/reverb/*' });
      expect(messages).toHaveLength(1);
      expect(messages[0]?.address).toBe('/fx/reverb/room');
    });

    it('should handle exact matches', () => {
      const messages = buffer.getMessages({ addressPattern: '/drum/kick' });
      expect(messages).toHaveLength(1);
      expect(messages[0]?.address).toBe('/drum/kick');
    });
  });

  describe('buffer management', () => {
    it('should clear all messages', () => {
      buffer.addMessage(createTestMessage('/test1'));
      buffer.addMessage(createTestMessage('/test2'));
      
      buffer.clear();
      
      expect(buffer.getMessageCount()).toBe(0);
      expect(buffer.getTotalMessagesReceived()).toBe(0);
    });

    it('should update configuration', () => {
      buffer.updateConfig({ maxSize: 10 });
      expect(buffer.getConfig().maxSize).toBe(10);

      buffer.updateConfig({ addressFilters: ['/test/*'] });
      expect(buffer.getConfig().addressFilters).toEqual(['/test/*']);
    });

    it('should resize buffer and keep newest messages when shrinking', () => {
      // Fill buffer with 5 messages
      const now = new Date();
      for (let i = 0; i < 5; i++) {
        buffer.addMessage(createTestMessage(`/test${i}`, new Date(now.getTime() + i * 1000)));
      }

      // Shrink buffer to size 3
      buffer.updateConfig({ maxSize: 3 });
      
      expect(buffer.getMessageCount()).toBe(3);
      
      // Should keep the 3 newest messages
      const messages = buffer.getMessages();
      expect(messages[0]?.address).toBe('/test4'); // newest
      expect(messages[1]?.address).toBe('/test3');
      expect(messages[2]?.address).toBe('/test2');
    });

    it('should handle growing buffer size', () => {
      buffer.addMessage(createTestMessage('/test1'));
      buffer.addMessage(createTestMessage('/test2'));
      
      buffer.updateConfig({ maxSize: 10 });
      
      expect(buffer.getMessageCount()).toBe(2);
      expect(buffer.getConfig().maxSize).toBe(10);
    });
  });

  describe('createMessageBuffer factory function', () => {
    it('should create buffer with specified configuration', () => {
      const config: MessageBufferConfig = {
        maxSize: 100,
        addressFilters: ['/test/*']
      };
      
      const newBuffer = createMessageBuffer(config);
      const bufferConfig = newBuffer.getConfig();
      
      expect(bufferConfig.maxSize).toBe(100);
      expect(bufferConfig.addressFilters).toEqual(['/test/*']);
    });
  });

  describe('edge cases', () => {
    it('should handle empty address patterns', () => {
      buffer.addMessage(createTestMessage('/test'));
      const messages = buffer.getMessages({ addressPattern: '' });
      expect(messages).toHaveLength(0);
    });

    it('should handle invalid time windows', () => {
      buffer.addMessage(createTestMessage('/test'));
      
      // Future timestamp for 'since'
      const futureMessages = buffer.getMessages({ 
        since: new Date(Date.now() + 1000) 
      });
      expect(futureMessages).toHaveLength(0);
      
      // Past timestamp for 'until'
      const pastMessages = buffer.getMessages({ 
        until: new Date(Date.now() - 1000) 
      });
      expect(pastMessages).toHaveLength(0);
    });

    it('should handle zero or negative limits', () => {
      buffer.addMessage(createTestMessage('/test1'));
      buffer.addMessage(createTestMessage('/test2'));
      
      const zeroLimit = buffer.getMessages({ limit: 0 });
      expect(zeroLimit).toHaveLength(0);
      
      const negativeLimit = buffer.getMessages({ limit: -1 });
      expect(negativeLimit).toHaveLength(2); // Should ignore negative limit
    });
  });
});