import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/prisma.js';
import { 
  addToOutbox, 
  processOutbox, 
  markCompleted, 
  markFailed, 
  retryFailed,
  getOutboxStats,
  cleanupOldEntries,
} from './outbox.js';
import { OutboxStatus } from '@prisma/client';
import { createEvent, EventTypes, Aggregates } from '@/lib/events.js';

describe('Outbox Service', () => {
  beforeEach(async () => {
    // Clean up outbox table before each test
    await prisma.outbox.deleteMany();
  });

  afterEach(async () => {
    // Clean up after each test
    await prisma.outbox.deleteMany();
  });

  describe('addToOutbox', () => {
    it('should add an event to the outbox with PENDING status', async () => {
      const event = createEvent(
        EventTypes.TASK_CREATED,
        Aggregates.TASK,
        'task-123',
        {
          taskId: 'task-123',
          customerId: 'user-1',
          agentId: 'agent-1',
          title: 'Test Task',
          budget: 100,
        }
      );

      await addToOutbox(event);

      const entries = await prisma.outbox.findMany();
      expect(entries).toHaveLength(1);
      expect(entries[0].type).toBe(EventTypes.TASK_CREATED);
      expect(entries[0].aggregate).toBe(Aggregates.TASK);
      expect(entries[0].aggregateId).toBe('task-123');
      expect(entries[0].status).toBe(OutboxStatus.PENDING);
      expect(entries[0].retryCount).toBe(0);
      expect(entries[0].payload).toMatchObject({
        taskId: 'task-123',
        title: 'Test Task',
      });
    });

    it('should add multiple events to the outbox', async () => {
      const event1 = createEvent(
        EventTypes.TASK_CREATED,
        Aggregates.TASK,
        'task-1',
        { taskId: 'task-1', title: 'Task 1', budget: 100 }
      );
      const event2 = createEvent(
        EventTypes.TASK_COMPLETED,
        Aggregates.TASK,
        'task-2',
        { taskId: 'task-2', completedAt: new Date().toISOString() }
      );

      await addToOutbox(event1);
      await addToOutbox(event2);

      const entries = await prisma.outbox.findMany();
      expect(entries).toHaveLength(2);
    });
  });

  describe('markCompleted', () => {
    it('should mark an outbox entry as completed', async () => {
      const entry = await prisma.outbox.create({
        data: {
          aggregate: Aggregates.TASK,
          aggregateId: 'task-123',
          type: EventTypes.TASK_CREATED,
          payload: { taskId: 'task-123' },
          status: OutboxStatus.PROCESSING,
        },
      });

      await markCompleted(entry.id);

      const updated = await prisma.outbox.findUnique({
        where: { id: entry.id },
      });
      expect(updated?.status).toBe(OutboxStatus.COMPLETED);
      expect(updated?.processedAt).toBeTruthy();
    });

    it('should clear error when marking as completed', async () => {
      const entry = await prisma.outbox.create({
        data: {
          aggregate: Aggregates.TASK,
          aggregateId: 'task-123',
          type: EventTypes.TASK_CREATED,
          payload: { taskId: 'task-123' },
          status: OutboxStatus.PROCESSING,
          error: 'Previous error',
        },
      });

      await markCompleted(entry.id);

      const updated = await prisma.outbox.findUnique({
        where: { id: entry.id },
      });
      expect(updated?.error).toBeNull();
    });
  });

  describe('markFailed', () => {
    it('should increment retry count on failure', async () => {
      const entry = await prisma.outbox.create({
        data: {
          aggregate: Aggregates.TASK,
          aggregateId: 'task-123',
          type: EventTypes.TASK_CREATED,
          payload: { taskId: 'task-123' },
          status: OutboxStatus.PROCESSING,
          retryCount: 0,
        },
      });

      await markFailed(entry.id, 'Processing error');

      const updated = await prisma.outbox.findUnique({
        where: { id: entry.id },
      });
      expect(updated?.retryCount).toBe(1);
      expect(updated?.error).toBe('Processing error');
      expect(updated?.status).toBe(OutboxStatus.PENDING); // Not yet at max retries
    });

    it('should mark as FAILED after max retries exceeded', async () => {
      const entry = await prisma.outbox.create({
        data: {
          aggregate: Aggregates.TASK,
          aggregateId: 'task-123',
          type: EventTypes.TASK_CREATED,
          payload: { taskId: 'task-123' },
          status: OutboxStatus.PROCESSING,
          retryCount: 2, // Already at 2, max is 3
        },
      });

      await markFailed(entry.id, 'Final error');

      const updated = await prisma.outbox.findUnique({
        where: { id: entry.id },
      });
      expect(updated?.retryCount).toBe(3);
      expect(updated?.status).toBe(OutboxStatus.FAILED);
      expect(updated?.processedAt).toBeTruthy();
    });
  });

  describe('processOutbox', () => {
    it('should process pending entries', async () => {
      await prisma.outbox.create({
        data: {
          aggregate: Aggregates.TASK,
          aggregateId: 'task-123',
          type: EventTypes.TASK_CREATED,
          payload: { taskId: 'task-123', title: 'Test' },
          status: OutboxStatus.PENDING,
        },
      });

      const processed = await processOutbox(10);

      expect(processed).toBe(1);
      const entries = await prisma.outbox.findMany();
      expect(entries[0].status).toBe(OutboxStatus.COMPLETED);
    });

    it('should process entries in FIFO order', async () => {
      const now = new Date();
      
      await prisma.outbox.create({
        data: {
          aggregate: Aggregates.TASK,
          aggregateId: 'task-2',
          type: EventTypes.TASK_COMPLETED,
          payload: { taskId: 'task-2' },
          status: OutboxStatus.PENDING,
          createdAt: new Date(now.getTime() + 1000),
        },
      });

      await prisma.outbox.create({
        data: {
          aggregate: Aggregates.TASK,
          aggregateId: 'task-1',
          type: EventTypes.TASK_CREATED,
          payload: { taskId: 'task-1' },
          status: OutboxStatus.PENDING,
          createdAt: new Date(now.getTime()),
        },
      });

      await processOutbox(10);

      const entries = await prisma.outbox.findMany({
        orderBy: { createdAt: 'asc' },
      });
      
      expect(entries[0].status).toBe(OutboxStatus.COMPLETED);
      expect(entries[1].status).toBe(OutboxStatus.COMPLETED);
    });

    it('should respect batch size', async () => {
      for (let i = 0; i < 5; i++) {
        await prisma.outbox.create({
          data: {
            aggregate: Aggregates.TASK,
            aggregateId: `task-${i}`,
            type: EventTypes.TASK_CREATED,
            payload: { taskId: `task-${i}` },
            status: OutboxStatus.PENDING,
          },
        });
      }

      const processed = await processOutbox(3);

      expect(processed).toBe(3);
      const pendingCount = await prisma.outbox.count({
        where: { status: OutboxStatus.PENDING },
      });
      expect(pendingCount).toBe(2);
    });

    it('should return 0 when no pending entries', async () => {
      const processed = await processOutbox(10);
      expect(processed).toBe(0);
    });
  });

  describe('retryFailed', () => {
    it('should reset failed entries to pending', async () => {
      await prisma.outbox.create({
        data: {
          aggregate: Aggregates.TASK,
          aggregateId: 'task-123',
          type: EventTypes.TASK_CREATED,
          payload: { taskId: 'task-123' },
          status: OutboxStatus.FAILED,
          retryCount: 1,
          processedAt: new Date(),
        },
      });

      const retried = await retryFailed();

      expect(retried).toBe(1);
      const entry = await prisma.outbox.findFirst();
      expect(entry?.status).toBe(OutboxStatus.PENDING);
      expect(entry?.processedAt).toBeNull();
    });

    it('should not retry entries at max retries', async () => {
      await prisma.outbox.create({
        data: {
          aggregate: Aggregates.TASK,
          aggregateId: 'task-123',
          type: EventTypes.TASK_CREATED,
          payload: { taskId: 'task-123' },
          status: OutboxStatus.FAILED,
          retryCount: 3, // At max
        },
      });

      const retried = await retryFailed();

      expect(retried).toBe(0);
      const entry = await prisma.outbox.findFirst();
      expect(entry?.status).toBe(OutboxStatus.FAILED);
    });

    it('should return 0 when no failed entries', async () => {
      const retried = await retryFailed();
      expect(retried).toBe(0);
    });
  });

  describe('getOutboxStats', () => {
    it('should return correct statistics', async () => {
      // Create entries with different statuses
      await prisma.outbox.create({
        data: { aggregate: 'task', aggregateId: '1', type: 'Test', payload: {}, status: OutboxStatus.PENDING },
      });
      await prisma.outbox.create({
        data: { aggregate: 'task', aggregateId: '2', type: 'Test', payload: {}, status: OutboxStatus.PENDING },
      });
      await prisma.outbox.create({
        data: { aggregate: 'task', aggregateId: '3', type: 'Test', payload: {}, status: OutboxStatus.PROCESSING },
      });
      await prisma.outbox.create({
        data: { aggregate: 'task', aggregateId: '4', type: 'Test', payload: {}, status: OutboxStatus.COMPLETED },
      });
      await prisma.outbox.create({
        data: { aggregate: 'task', aggregateId: '5', type: 'Test', payload: {}, status: OutboxStatus.FAILED },
      });

      const stats = await getOutboxStats();

      expect(stats).toEqual({
        pending: 2,
        processing: 1,
        completed: 1,
        failed: 1,
        total: 5,
      });
    });

    it('should return zeros when no entries', async () => {
      const stats = await getOutboxStats();

      expect(stats).toEqual({
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        total: 0,
      });
    });
  });

  describe('cleanupOldEntries', () => {
    it('should delete old completed entries', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);

      await prisma.outbox.create({
        data: {
          aggregate: 'task',
          aggregateId: 'old',
          type: 'Test',
          payload: {},
          status: OutboxStatus.COMPLETED,
          processedAt: oldDate,
        },
      });

      await prisma.outbox.create({
        data: {
          aggregate: 'task',
          aggregateId: 'recent',
          type: 'Test',
          payload: {},
          status: OutboxStatus.COMPLETED,
          processedAt: new Date(),
        },
      });

      const deleted = await cleanupOldEntries(7);

      expect(deleted).toBe(1);
      const remaining = await prisma.outbox.findMany();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].aggregateId).toBe('recent');
    });

    it('should delete old failed entries', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 15);

      await prisma.outbox.create({
        data: {
          aggregate: 'task',
          aggregateId: 'failed-old',
          type: 'Test',
          payload: {},
          status: OutboxStatus.FAILED,
          processedAt: oldDate,
        },
      });

      const deleted = await cleanupOldEntries(7);

      expect(deleted).toBe(1);
    });

    it('should not delete pending entries', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);

      await prisma.outbox.create({
        data: {
          aggregate: 'task',
          aggregateId: 'pending-old',
          type: 'Test',
          payload: {},
          status: OutboxStatus.PENDING,
          createdAt: oldDate,
        },
      });

      const deleted = await cleanupOldEntries(7);

      expect(deleted).toBe(0);
    });
  });
});
