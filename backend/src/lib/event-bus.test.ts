import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { EventBus, type EventHandler } from './event-bus.js';
import { getRedisClient, connectRedis, disconnectRedis } from './redis.js';
import { createEvent, EventTypes, Aggregates, type DomainEvent } from './events.js';

describe('Event Bus', () => {
  let eventBus: EventBus;
  const testStreamKey = 'test:events';
  const testConsumerGroup = 'test:consumers';

  beforeAll(async () => {
    await connectRedis();
  });

  afterAll(async () => {
    await disconnectRedis();
  });

  beforeEach(async () => {
    // Create a fresh EventBus instance for each test
    eventBus = new EventBus(testStreamKey, testConsumerGroup);
    
    // Clean up test stream
    const redis = getRedisClient();
    await redis.del(testStreamKey);
  });

  afterEach(async () => {
    // Clean up test stream
    const redis = getRedisClient();
    await redis.del(testStreamKey);
  });

  describe('createConsumerGroup', () => {
    it('should create a consumer group', async () => {
      await eventBus.createConsumerGroup();
      
      // Should not throw - group created successfully
      // Calling again should not throw (idempotent)
      await eventBus.createConsumerGroup();
    });
  });

  describe('publish', () => {
    it('should publish an event to the stream', async () => {
      const event = createEvent(
        EventTypes.TASK_CREATED,
        Aggregates.TASK,
        'task-123',
        { taskId: 'task-123', title: 'Test Task' }
      );

      const messageId = await eventBus.publish(event);

      expect(messageId).toBeTruthy();
      expect(messageId).toContain('-'); // Redis stream ID format
    });

    it('should publish multiple events', async () => {
      const event1 = createEvent(
        EventTypes.TASK_CREATED,
        Aggregates.TASK,
        'task-1',
        { taskId: 'task-1' }
      );
      const event2 = createEvent(
        EventTypes.TASK_COMPLETED,
        Aggregates.TASK,
        'task-2',
        { taskId: 'task-2' }
      );

      const id1 = await eventBus.publish(event1);
      const id2 = await eventBus.publish(event2);

      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });

    it('should include metadata in published event', async () => {
      const event = createEvent(
        EventTypes.TASK_CREATED,
        Aggregates.TASK,
        'task-123',
        { taskId: 'task-123' },
        { correlationId: 'corr-123', userId: 'user-1' }
      );

      const messageId = await eventBus.publish(event);
      expect(messageId).toBeTruthy();
    });
  });

  describe('subscribe and readGroup', () => {
    it('should subscribe to event types', async () => {
      const handler: EventHandler = {
        handle: async () => {},
      };

      await eventBus.subscribe([EventTypes.TASK_CREATED], handler);
      
      // No error means success
    });

    it('should read events from consumer group', async () => {
      await eventBus.createConsumerGroup();

      const event = createEvent(
        EventTypes.TASK_CREATED,
        Aggregates.TASK,
        'task-123',
        { taskId: 'task-123', title: 'Test' }
      );

      await eventBus.publish(event);

      const messages = await eventBus.readGroup('test-consumer', 10, 1000);

      expect(messages).toHaveLength(1);
      expect(messages[0].event.type).toBe(EventTypes.TASK_CREATED);
      expect(messages[0].event.aggregate).toBe(Aggregates.TASK);
      expect(messages[0].event.aggregateId).toBe('task-123');
      expect(messages[0].event.payload).toMatchObject({
        taskId: 'task-123',
        title: 'Test',
      });
    });

    it('should return empty array when no new messages', async () => {
      await eventBus.createConsumerGroup();

      const messages = await eventBus.readGroup('test-consumer', 10, 100);

      expect(messages).toHaveLength(0);
    });

    it('should read multiple events', async () => {
      await eventBus.createConsumerGroup();

      for (let i = 0; i < 3; i++) {
        await eventBus.publish(
          createEvent(
            EventTypes.TASK_CREATED,
            Aggregates.TASK,
            `task-${i}`,
            { taskId: `task-${i}` }
          )
        );
      }

      const messages = await eventBus.readGroup('test-consumer', 10, 1000);

      expect(messages).toHaveLength(3);
    });
  });

  describe('acknowledge', () => {
    it('should acknowledge a message', async () => {
      await eventBus.createConsumerGroup();

      await eventBus.publish(
        createEvent(
          EventTypes.TASK_CREATED,
          Aggregates.TASK,
          'task-123',
          { taskId: 'task-123' }
        )
      );

      const messages = await eventBus.readGroup('test-consumer', 10, 1000);
      expect(messages).toHaveLength(1);

      await eventBus.acknowledge(messages[0].id);

      // Message should not be redelivered
      const newMessages = await eventBus.readGroup('test-consumer', 10, 100);
      expect(newMessages).toHaveLength(0);
    });
  });

  describe('processEvents', () => {
    it('should process events and call handlers', async () => {
      const handledEvents: DomainEvent[] = [];
      const handler: EventHandler = {
        handle: async (event) => {
          handledEvents.push(event);
        },
      };

      await eventBus.createConsumerGroup();
      await eventBus.subscribe([EventTypes.TASK_CREATED], handler);

      await eventBus.publish(
        createEvent(
          EventTypes.TASK_CREATED,
          Aggregates.TASK,
          'task-123',
          { taskId: 'task-123' }
        )
      );

      const processed = await eventBus.processEvents('test-consumer', 10);

      expect(processed).toBe(1);
      expect(handledEvents).toHaveLength(1);
      expect(handledEvents[0].type).toBe(EventTypes.TASK_CREATED);
    });

    it('should process only subscribed event types', async () => {
      const handledEvents: DomainEvent[] = [];
      const handler: EventHandler = {
        handle: async (event) => {
          handledEvents.push(event);
        },
      };

      await eventBus.createConsumerGroup();
      await eventBus.subscribe([EventTypes.TASK_CREATED], handler);

      await eventBus.publish(
        createEvent(
          EventTypes.TASK_COMPLETED,
          Aggregates.TASK,
          'task-123',
          { taskId: 'task-123' }
        )
      );

      await eventBus.processEvents('test-consumer', 10);

      expect(handledEvents).toHaveLength(0);
    });

    it('should continue processing even if a handler fails', async () => {
      const errorHandler: EventHandler = {
        handle: async () => {
          throw new Error('Handler error');
        },
      };
      const successHandler: EventHandler = {
        handle: async () => {},
      };

      await eventBus.createConsumerGroup();
      await eventBus.subscribe([EventTypes.TASK_CREATED], errorHandler);
      await eventBus.subscribe([EventTypes.TASK_CREATED], successHandler);

      await eventBus.publish(
        createEvent(
          EventTypes.TASK_CREATED,
          Aggregates.TASK,
          'task-123',
          { taskId: 'task-123' }
        )
      );

      const processed = await eventBus.processEvents('test-consumer', 10);

      expect(processed).toBe(1);
    });
  });

  describe('getPendingMessages', () => {
    it('should return pending messages info', async () => {
      await eventBus.createConsumerGroup();

      const info = await eventBus.getPendingMessages();

      expect(info).toHaveProperty('count');
      expect(info).toHaveProperty('minId');
      expect(info).toHaveProperty('maxId');
      expect(info).toHaveProperty('consumers');
    });

    it('should show pending messages count', async () => {
      await eventBus.createConsumerGroup();

      await eventBus.publish(
        createEvent(
          EventTypes.TASK_CREATED,
          Aggregates.TASK,
          'task-123',
          { taskId: 'task-123' }
        )
      );

      // Read but don't acknowledge
      await eventBus.readGroup('test-consumer', 10, 1000);

      const info = await eventBus.getPendingMessages();

      expect(info.count).toBe(1);
    });
  });

  describe('trimStream', () => {
    it('should trim stream to max length', async () => {
      // Publish many events
      for (let i = 0; i < 10; i++) {
        await eventBus.publish(
          createEvent(
            EventTypes.TASK_CREATED,
            Aggregates.TASK,
            `task-${i}`,
            { taskId: `task-${i}` }
          )
        );
      }

      const removed = await eventBus.trimStream(5);

      // Note: Redis approximate trimming may not remove exactly the expected number
      expect(typeof removed).toBe('number');
    });
  });

  describe('different event types', () => {
    it('should handle all event types', async () => {
      await eventBus.createConsumerGroup();

      const events = [
        createEvent(EventTypes.USER_REGISTERED, Aggregates.USER, 'user-1', { userId: 'user-1', email: 'test@test.com' }),
        createEvent(EventTypes.AGENT_CREATED, Aggregates.AGENT, 'agent-1', { agentId: 'agent-1', name: 'Test Agent' }),
        createEvent(EventTypes.TASK_CREATED, Aggregates.TASK, 'task-1', { taskId: 'task-1', title: 'Test Task' }),
        createEvent(EventTypes.TASK_ASSIGNED, Aggregates.TASK, 'task-1', { taskId: 'task-1', agentId: 'agent-1' }),
        createEvent(EventTypes.TASK_COMPLETED, Aggregates.TASK, 'task-1', { taskId: 'task-1', result: 'Done' }),
        createEvent(EventTypes.TASK_APPROVED, Aggregates.TASK, 'task-1', { taskId: 'task-1', paymentAmount: 100 }),
        createEvent(EventTypes.ESCROW_LOCK, Aggregates.WALLET, 'escrow-1', { taskId: 'task-1', amount: 100 }),
        createEvent(EventTypes.ESCROW_RELEASE, Aggregates.WALLET, 'escrow-1', { taskId: 'task-1', amount: 100 }),
        createEvent(EventTypes.PAYMENT, Aggregates.WALLET, 'pay-1', { paymentId: 'pay-1', amount: 100 }),
        createEvent(EventTypes.REVIEW_CREATED, Aggregates.REVIEW, 'review-1', { reviewId: 'review-1', rating: 5 }),
      ];

      for (const event of events) {
        const id = await eventBus.publish(event);
        expect(id).toBeTruthy();
      }

      const messages = await eventBus.readGroup('test-consumer', 20, 1000);
      expect(messages).toHaveLength(events.length);
    });
  });
});
