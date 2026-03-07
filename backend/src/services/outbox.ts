/**
 * Outbox Service
 * 
 * Implements the Outbox Pattern for reliable event publishing.
 * Events are first written to the outbox table, then processed
 * asynchronously and published to the event bus.
 */

import { prisma } from '@/lib/prisma.js';
import { getEventBus } from '@/lib/event-bus.js';
import { logger } from '@/lib/logger.js';
import { outboxPending } from '@/lib/metrics.js';
import { type DomainEvent } from '@/lib/events.js';
import { OutboxStatus } from '@prisma/client';

// Configuration
const MAX_RETRY_COUNT = 3;
const DEFAULT_BATCH_SIZE = 10;

/**
 * Add an event to the outbox for asynchronous processing
 * @param event - The domain event to add
 */
export async function addToOutbox(event: DomainEvent): Promise<void> {
  try {
    await prisma.outbox.create({
      data: {
        aggregate: event.aggregate,
        aggregateId: event.aggregateId,
        type: event.type,
        payload: event.payload as Record<string, unknown>,
        status: OutboxStatus.PENDING,
        retryCount: 0,
      },
    });

    logger.debug(
      { type: event.type, aggregate: event.aggregate, aggregateId: event.aggregateId },
      'Added event to outbox'
    );
  } catch (err) {
    logger.error(
      { err, event },
      'Failed to add event to outbox'
    );
    throw err;
  }
}

/**
 * Mark an outbox entry as completed
 * @param id - The outbox entry ID
 */
export async function markCompleted(id: string): Promise<void> {
  try {
    await prisma.outbox.update({
      where: { id },
      data: {
        status: OutboxStatus.COMPLETED,
        processedAt: new Date(),
        error: null,
      },
    });

    logger.debug({ outboxId: id }, 'Marked outbox entry as completed');
  } catch (err) {
    logger.error({ err, outboxId: id }, 'Failed to mark outbox entry as completed');
    throw err;
  }
}

/**
 * Mark an outbox entry as failed
 * @param id - The outbox entry ID
 * @param error - The error message
 */
export async function markFailed(id: string, error: string): Promise<void> {
  try {
    const entry = await prisma.outbox.findUnique({
      where: { id },
    });

    if (!entry) {
      throw new Error(`Outbox entry not found: ${id}`);
    }

    const newRetryCount = entry.retryCount + 1;
    const shouldFail = newRetryCount >= MAX_RETRY_COUNT;

    await prisma.outbox.update({
      where: { id },
      data: {
        status: shouldFail ? OutboxStatus.FAILED : OutboxStatus.PENDING,
        retryCount: newRetryCount,
        error: error.substring(0, 1000), // Limit error message length
        processedAt: shouldFail ? new Date() : null,
      },
    });

    logger.warn(
      { 
        outboxId: id, 
        retryCount: newRetryCount, 
        maxRetries: MAX_RETRY_COUNT,
        finalFailure: shouldFail 
      },
      shouldFail ? 'Outbox entry marked as failed after max retries' : 'Outbox entry failed, will retry'
    );
  } catch (err) {
    logger.error({ err, outboxId: id }, 'Failed to mark outbox entry as failed');
    throw err;
  }
}

/**
 * Process pending outbox entries
 * @param batchSize - Number of entries to process in one batch
 * @returns Number of entries processed
 */
export async function processOutbox(batchSize: number = DEFAULT_BATCH_SIZE): Promise<number> {
  const eventBus = getEventBus();
  let processed = 0;

  try {
    // Fetch pending entries ordered by creation time (FIFO)
    const pendingEntries = await prisma.outbox.findMany({
      where: { status: OutboxStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
    });

    if (pendingEntries.length === 0) {
      return 0;
    }

    logger.debug(
      { count: pendingEntries.length },
      'Processing outbox entries'
    );

    for (const entry of pendingEntries) {
      try {
        // Mark as processing to prevent concurrent processing
        await prisma.outbox.update({
          where: { id: entry.id },
          data: { status: OutboxStatus.PROCESSING },
        });

        // Reconstruct the domain event
        const event: DomainEvent = {
          type: entry.type,
          aggregate: entry.aggregate,
          aggregateId: entry.aggregateId,
          payload: entry.payload as Record<string, unknown>,
        };

        // Publish to event bus
        await eventBus.publish(event);

        // Mark as completed
        await markCompleted(entry.id);
        processed++;

        logger.debug(
          { outboxId: entry.id, type: entry.type },
          'Successfully processed outbox entry'
        );
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        await markFailed(entry.id, errorMessage);
        
        logger.error(
          { err, outboxId: entry.id, type: entry.type },
          'Failed to process outbox entry'
        );
      }
    }

    // Update metrics
    const pendingCount = await prisma.outbox.count({
      where: { status: OutboxStatus.PENDING },
    });
    outboxPending.set(pendingCount);

    return processed;
  } catch (err) {
    logger.error({ err }, 'Error processing outbox');
    throw err;
  }
}

/**
 * Retry failed outbox entries
 * Resets FAILED entries back to PENDING for retry
 * @returns Number of entries queued for retry
 */
export async function retryFailed(): Promise<number> {
  try {
    // Find failed entries that haven't exceeded max retries
    const failedEntries = await prisma.outbox.findMany({
      where: {
        status: OutboxStatus.FAILED,
        retryCount: { lt: MAX_RETRY_COUNT },
      },
    });

    if (failedEntries.length === 0) {
      return 0;
    }

    // Reset failed entries to pending
    const result = await prisma.outbox.updateMany({
      where: {
        id: { in: failedEntries.map(e => e.id) },
      },
      data: {
        status: OutboxStatus.PENDING,
        processedAt: null,
      },
    });

    logger.info(
      { count: result.count },
      'Retrying failed outbox entries'
    );

    return result.count;
  } catch (err) {
    logger.error({ err }, 'Error retrying failed outbox entries');
    throw err;
  }
}

/**
 * Get outbox statistics
 */
export async function getOutboxStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}> {
  const [pending, processing, completed, failed, total] = await Promise.all([
    prisma.outbox.count({ where: { status: OutboxStatus.PENDING } }),
    prisma.outbox.count({ where: { status: OutboxStatus.PROCESSING } }),
    prisma.outbox.count({ where: { status: OutboxStatus.COMPLETED } }),
    prisma.outbox.count({ where: { status: OutboxStatus.FAILED } }),
    prisma.outbox.count(),
  ]);

  return { pending, processing, completed, failed, total };
}

/**
 * Clean up old completed outbox entries
 * @param olderThanDays - Delete entries older than this many days
 * @returns Number of entries deleted
 */
export async function cleanupOldEntries(olderThanDays: number = 7): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  try {
    const result = await prisma.outbox.deleteMany({
      where: {
        status: { in: [OutboxStatus.COMPLETED, OutboxStatus.FAILED] },
        processedAt: { lt: cutoffDate },
      },
    });

    logger.info(
      { deleted: result.count, olderThanDays },
      'Cleaned up old outbox entries'
    );

    return result.count;
  } catch (err) {
    logger.error({ err }, 'Error cleaning up old outbox entries');
    throw err;
  }
}
