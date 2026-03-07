import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  getRedisClient,
  getPublisherClient,
  getSubscriberClient,
  connectRedis,
  disconnectRedis,
  healthCheck,
} from './redis.js';
import { publish, subscribe, unsubscribe } from './redis-pubsub.js';
import {
  addToStream,
  readFromStream,
  createConsumerGroup,
  readGroup,
  acknowledgeMessage,
  deleteStream,
} from './redis-streams.js';

describe('Redis Client', () => {
  const testStreamKey = 'test:stream';
  const testGroup = 'test-group';
  const testConsumer = 'test-consumer';
  const testChannel = 'test:channel';

  beforeAll(async () => {
    // Connect all Redis clients on startup
    await connectRedis();
  });

  afterAll(async () => {
    // Cleanup
    await deleteStream(testStreamKey);
    await disconnectRedis();
  });

  beforeEach(async () => {
    // Clean up test stream before each test
    const client = getRedisClient();
    await client.del(testStreamKey);
    // Clean up consumer group if exists
    try {
      await client.xgroup('DESTROY', testStreamKey, testGroup);
    } catch {
      // Group might not exist
    }
  });

  describe('Connection', () => {
    it('should return PONG when ping is called', async () => {
      const client = getRedisClient();
      const pong = await client.ping();
      expect(pong).toBe('PONG');
    });

    it('should return the same singleton instance', () => {
      const client1 = getRedisClient();
      const client2 = getRedisClient();
      expect(client1).toBe(client2);
    });

    it('should have separate pub/sub clients', () => {
      const main = getRedisClient();
      const pub = getPublisherClient();
      const sub = getSubscriberClient();

      expect(main).not.toBe(pub);
      expect(main).not.toBe(sub);
      expect(pub).not.toBe(sub);
    });
  });

  describe('Pub/Sub', () => {
    it('should subscribe to a channel and receive published messages', async () => {
      const messages: Array<{ text: string }> = [];
      const channel = 'test:pubsub:1';

      // Subscribe to channel
      await subscribe(channel, (message: { text: string }) => {
        messages.push(message);
      });

      // Publish a message (object)
      await publish(channel, { text: 'Hello, Redis!' });

      // Wait for message to be received
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ text: 'Hello, Redis!' });

      // Cleanup
      await unsubscribe(channel);
    });

    it('should receive multiple messages from the same channel', async () => {
      const messages: Array<{ num: number }> = [];
      const channel = 'test:pubsub:2';

      await subscribe(channel, (message: { num: number }) => {
        messages.push(message);
      });

      await publish(channel, { num: 1 });
      await publish(channel, { num: 2 });
      await publish(channel, { num: 3 });

      // Wait for messages to be received
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(messages).toHaveLength(3);
      expect(messages).toEqual([{ num: 1 }, { num: 2 }, { num: 3 }]);

      // Cleanup
      await unsubscribe(channel);
    });

    it('should handle different channels independently', async () => {
      const channel1Messages: string[] = [];
      const channel2Messages: string[] = [];

      await subscribe('channel:1', (message: { data: string }) => {
        channel1Messages.push(message.data);
      });

      await subscribe('channel:2', (message: { data: string }) => {
        channel2Messages.push(message.data);
      });

      await publish('channel:1', { data: 'Only in channel 1' });
      await publish('channel:2', { data: 'Only in channel 2' });

      // Wait for messages to be received
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(channel1Messages).toHaveLength(1);
      expect(channel1Messages[0]).toBe('Only in channel 1');
      expect(channel2Messages).toHaveLength(1);
      expect(channel2Messages[0]).toBe('Only in channel 2');

      // Cleanup
      await unsubscribe('channel:1');
      await unsubscribe('channel:2');
    });
  });

  describe('Streams', () => {
    it('should add and read entries from a stream', async () => {
      // Add entry to stream
      const id1 = await addToStream(testStreamKey, { field1: 'value1', field2: 'value2' });
      expect(typeof id1).toBe('string');
      expect(id1).toContain('-');

      // Read entries
      const messages = await readFromStream(testStreamKey, '0', 100);
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe(id1);
      expect(messages[0].data).toEqual({ field1: 'value1', field2: 'value2' });
    });

    it('should read multiple entries from a stream', async () => {
      await addToStream(testStreamKey, { data: 'first' });
      await addToStream(testStreamKey, { data: 'second' });
      await addToStream(testStreamKey, { data: 'third' });

      const messages = await readFromStream(testStreamKey, '0', 100);
      expect(messages).toHaveLength(3);
      expect(messages[0].data.data).toBe('first');
      expect(messages[1].data.data).toBe('second');
      expect(messages[2].data.data).toBe('third');
    });

    it('should read from specific ID', async () => {
      const id1 = await addToStream(testStreamKey, { data: 'first' });
      await addToStream(testStreamKey, { data: 'second' });

      // Read after id1 (should only get second entry)
      const messages = await readFromStream(testStreamKey, id1, 100);
      expect(messages).toHaveLength(1);
      expect(messages[0].data.data).toBe('second');
    });

    it('should return empty array for non-existent stream', async () => {
      const messages = await readFromStream('non:existent:stream', '0', 100);
      expect(messages).toEqual([]);
    });
  });

  describe('Consumer Groups', () => {
    it('should create a consumer group', async () => {
      await createConsumerGroup(testStreamKey, testGroup, '0');

      // Verify by adding and reading from group
      const id = await addToStream(testStreamKey, { test: 'data' });
      expect(id).toBeDefined();
    });

    it('should read from consumer group without error on duplicate creation', async () => {
      // Create group twice should not throw
      await createConsumerGroup(testStreamKey, testGroup, '0');
      await createConsumerGroup(testStreamKey, testGroup, '0');
    });

    it('should read from consumer group and acknowledge messages', async () => {
      await createConsumerGroup(testStreamKey, testGroup, '0');

      // Add entries
      await addToStream(testStreamKey, { data: 'message1' });
      await addToStream(testStreamKey, { data: 'message2' });

      // Read as consumer
      const messages = await readGroup(testStreamKey, testGroup, testConsumer, 10, 1000);
      expect(messages.length).toBeGreaterThan(0);

      // Acknowledge messages
      for (const message of messages) {
        const acked = await acknowledgeMessage(testStreamKey, testGroup, message.id);
        expect(acked).toBe(1);
      }
    });
  });

  describe('Health Check', () => {
    it('should return ok status with latency', async () => {
      const result = await healthCheck();
      expect(result.status).toBe('ok');
      expect(result.latency).toBeDefined();
      expect(typeof result.latency).toBe('number');
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });
  });
});
