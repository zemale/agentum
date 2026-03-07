/**
 * Audit Handler
 * 
 * Logs all domain events for audit trail and compliance.
 * Events are stored in the DomainEvent table for historical tracking.
 */

import { prisma } from '@/lib/prisma.js';
import { logger } from '@/lib/logger.js';
import { type DomainEvent } from '@/lib/events.js';
import { type EventHandler } from './registry.js';

/**
 * Audit Handler class
 * Handles logging all domain events to the audit log
 */
export class AuditHandler implements EventHandler {
  /**
   * Handle a domain event by logging it to the audit trail
   */
  async handle(event: DomainEvent): Promise<void> {
    try {
      // Store in DomainEvent table for persistence
      await prisma.domainEvent.create({
        data: {
          type: event.type,
          aggregate: event.aggregate,
          aggregateId: event.aggregateId,
          payload: event.payload as Record<string, unknown>,
        },
      });

      // Also log to application logs
      logger.info(
        {
          eventType: event.type,
          aggregate: event.aggregate,
          aggregateId: event.aggregateId,
          correlationId: event.metadata?.correlationId,
          userId: event.metadata?.userId,
        },
        'Audit: Domain event recorded'
      );
    } catch (err) {
      // Log error but don't throw - audit failure shouldn't break event processing
      logger.error(
        { err, event },
        'Audit: Failed to record domain event'
      );
    }
  }
}

/**
 * Query audit log for a specific aggregate
 * @param aggregate - The aggregate type
 * @param aggregateId - The aggregate ID
 * @returns Array of domain events
 */
export async function queryAuditLog(
  aggregate: string,
  aggregateId: string
): Promise<Array<{
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}>> {
  const events = await prisma.domainEvent.findMany({
    where: {
      aggregate,
      aggregateId,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  return events.map(e => ({
    id: e.id,
    type: e.type,
    payload: e.payload as Record<string, unknown>,
    createdAt: e.createdAt,
  }));
}

/**
 * Query audit log by event type
 * @param eventType - The event type
 * @param limit - Maximum number of results
 * @returns Array of domain events
 */
export async function queryAuditLogByType(
  eventType: string,
  limit: number = 100
): Promise<Array<{
  id: string;
  aggregate: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}>> {
  const events = await prisma.domainEvent.findMany({
    where: {
      type: eventType,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });

  return events.map(e => ({
    id: e.id,
    aggregate: e.aggregate,
    aggregateId: e.aggregateId,
    payload: e.payload as Record<string, unknown>,
    createdAt: e.createdAt,
  }));
}

/**
 * Get audit statistics
 */
export async function getAuditStats(): Promise<{
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByAggregate: Record<string, number>;
}> {
  const [
    totalEvents,
    typeStats,
    aggregateStats,
  ] = await Promise.all([
    prisma.domainEvent.count(),
    prisma.domainEvent.groupBy({
      by: ['type'],
      _count: { type: true },
    }),
    prisma.domainEvent.groupBy({
      by: ['aggregate'],
      _count: { aggregate: true },
    }),
  ]);

  const eventsByType: Record<string, number> = {};
  for (const stat of typeStats) {
    eventsByType[stat.type] = stat._count.type;
  }

  const eventsByAggregate: Record<string, number> = {};
  for (const stat of aggregateStats) {
    eventsByAggregate[stat.aggregate] = stat._count.aggregate;
  }

  return {
    totalEvents,
    eventsByType,
    eventsByAggregate,
  };
}

/**
 * Clean up old audit events
 * @param olderThanDays - Delete events older than this many days
 * @returns Number of events deleted
 */
export async function cleanupOldAuditEvents(olderThanDays: number = 90): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  try {
    const result = await prisma.domainEvent.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    logger.info(
      { deleted: result.count, olderThanDays },
      'Cleaned up old audit events'
    );

    return result.count;
  } catch (err) {
    logger.error({ err }, 'Error cleaning up old audit events');
    throw err;
  }
}
