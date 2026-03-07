/**
 * Event Bus using Redis Streams
 * 
 * Provides publish/subscribe functionality for domain events
 * using Redis Streams for durable, scalable message processing.
 */

import { getRedisClient } from './redis.js';
import { logger } from './logger.js';
import { type DomainEvent, createEvent } from './events.js';

// Stream configuration
const EVENT_STREAM_KEY = 'agentum:events';
const DEFAULT_CONSUMER_GROUP = 'agentum:event-consumers';

/**
 * Event handler function type
 */
export type EventHandler = (event: DomainEvent) => Promise<void>;

/**
 * Subscription configuration
 */
interface Subscription {
  eventTypes: string[];
  handler: EventHandler;
}

/**
 * EventBus class for publishing and subscribing to domain events
 */
export class EventBus {
  private redis = getRedisClient();
  private subscriptions: Map<string, Subscription[]> = new Map();
  private isRunning = false;
  private consumerGroup: string;
  private streamKey: string;

  constructor(
    streamKey: string = EVENT_STREAM_KEY,
    consumerGroup: string = DEFAULT_CONSUMER_GROUP
  ) {
    this.streamKey = streamKey;
    this.consumerGroup = consumerGroup;
  }

  /**
   * Create the consumer group for the event stream
   */
  async createConsumerGroup(): Promise<void> {
    try {
      await this.redis.xgroup(
        'CREATE',
        this.streamKey,
        this.consumerGroup,
        '0',
        'MKSTREAM'
      );
      logger.info(
        { stream: this.streamKey, group: this.consumerGroup },
        'Created consumer group'
      );
    } catch (err) {
      // Group already exists - not an error
      if (err instanceof Error && err.message.includes('already exists')) {
        logger.debug(
          { stream: this.streamKey, group: this.consumerGroup },
          'Consumer group already exists'
        );
        return;
      }
      logger.error(
        { err, stream: this.streamKey, group: this.consumerGroup },
        'Failed to create consumer group'
      );
      throw err;
    }
  }

  /**
   * Publish an event to the stream
   * @param event - The domain event to publish
   * @returns The ID of the added stream entry
   */
  async publish(event: DomainEvent): Promise<string> {
    const entries: string[] = [
      'type', event.type,
      'aggregate', event.aggregate,
      'aggregateId', event.aggregateId,
      'payload', JSON.stringify(event.payload),
    ];

    if (event.metadata) {
      entries.push('metadata', JSON.stringify(event.metadata));
    }

    try {
      const id = await this.redis.xadd(this.streamKey, '*', ...entries);
      if (!id) {
        throw new Error('Failed to add event to stream - xadd returned null');
      }
      logger.debug(
        { stream: this.streamKey, id, type: event.type, aggregate: event.aggregate },
        'Published event to stream'
      );
      return id;
    } catch (err) {
      logger.error(
        { err, stream: this.streamKey, event },
        'Failed to publish event to stream'
      );
      throw err;
    }
  }

  /**
   * Subscribe to specific event types
   * @param eventTypes - Array of event types to subscribe to
   * @param handler - Handler function for events
   */
  async subscribe(eventTypes: string[], handler: EventHandler): Promise<void> {
    for (const eventType of eventTypes) {
      const existing = this.subscriptions.get(eventType) || [];
      existing.push({ eventTypes, handler });
      this.subscriptions.set(eventType, existing);
    }
    logger.debug(
      { eventTypes, count: eventTypes.length },
      'Subscribed to event types'
    );
  }

  /**
   * Read messages from the consumer group
   * @param consumerName - Unique name for this consumer instance
   * @param count - Maximum number of messages to read
   * @param blockMs - Block for milliseconds waiting for messages (0 for no block)
   * @returns Array of domain events with their stream IDs
   */
  async readGroup(
    consumerName: string,
    count: number = 10,
    blockMs: number = 5000
  ): Promise<Array<{ id: string; event: DomainEvent }>> {
    const args: (string | number)[] = [
      'GROUP',
      this.consumerGroup,
      consumerName,
      'COUNT',
      count,
    ];

    if (blockMs > 0) {
      args.push('BLOCK', blockMs);
    }

    args.push('STREAMS', this.streamKey, '>');

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (this.redis.xreadgroup as any)(...args);

      if (!result || result.length === 0) {
        return [];
      }

      const events: Array<{ id: string; event: DomainEvent }> = [];

      for (const streamData of result) {
        const [, streamEntries] = streamData as [string, Array<[string, string[]]>];

        for (const [id, fields] of streamEntries) {
          const data: Record<string, string> = {};
          for (let i = 0; i < fields.length; i += 2) {
            data[fields[i]] = fields[i + 1];
          }

          const event: DomainEvent = {
            type: data.type,
            aggregate: data.aggregate,
            aggregateId: data.aggregateId,
            payload: JSON.parse(data.payload || '{}'),
            metadata: data.metadata ? JSON.parse(data.metadata) : undefined,
          };

          events.push({ id, event });
        }
      }

      return events;
    } catch (err) {
      logger.error(
        { err, stream: this.streamKey, group: this.consumerGroup, consumer: consumerName },
        'Failed to read from consumer group'
      );
      throw err;
    }
  }

  /**
   * Acknowledge a message in the consumer group
   * @param messageId - The message ID to acknowledge
   */
  async acknowledge(messageId: string): Promise<void> {
    try {
      await this.redis.xack(this.streamKey, this.consumerGroup, messageId);
      logger.debug(
        { stream: this.streamKey, group: this.consumerGroup, messageId },
        'Acknowledged message'
      );
    } catch (err) {
      logger.error(
        { err, stream: this.streamKey, group: this.consumerGroup, messageId },
        'Failed to acknowledge message'
      );
      throw err;
    }
  }

  /**
   * Process events and dispatch to registered handlers
   * @param consumerName - Unique name for this consumer instance
   * @param count - Maximum number of messages to process
   */
  async processEvents(consumerName: string, count: number = 10): Promise<number> {
    const messages = await this.readGroup(consumerName, count, 0);
    
    if (messages.length === 0) {
      return 0;
    }

    let processed = 0;

    for (const { id, event } of messages) {
      try {
        const handlers = this.subscriptions.get(event.type) || [];
        
        for (const subscription of handlers) {
          try {
            await subscription.handler(event);
          } catch (handlerErr) {
            logger.error(
              { err: handlerErr, eventType: event.type, eventId: id },
              'Event handler failed'
            );
            // Continue with other handlers even if one fails
          }
        }

        await this.acknowledge(id);
        processed++;
      } catch (err) {
        logger.error(
          { err, eventType: event.type, eventId: id },
          'Failed to process event'
        );
        // Don't acknowledge - message will be redelivered
      }
    }

    return processed;
  }

  /**
   * Get pending messages info for the consumer group
   * @returns Pending messages summary
   */
  async getPendingMessages(): Promise<{
    count: number;
    minId: string | null;
    maxId: string | null;
    consumers: Array<{ name: string; count: number }>;
  }> {
    try {
      const result = await this.redis.xpending(this.streamKey, this.consumerGroup);

      if (!result || result.length === 0) {
        return { count: 0, minId: null, maxId: null, consumers: [] };
      }

      const [count, minId, maxId, consumerData] = result as [
        number,
        string | null,
        string | null,
        Array<[string, string]>
      ];

      const consumers = consumerData
        ? consumerData.map(([name, consumerCount]) => ({
            name,
            count: parseInt(consumerCount, 10),
          }))
        : [];

      return { count, minId, maxId, consumers };
    } catch (err) {
      logger.error(
        { err, stream: this.streamKey, group: this.consumerGroup },
        'Failed to get pending messages'
      );
      throw err;
    }
  }

  /**
   * Trim the stream to a maximum length
   * @param maxLength - Maximum number of entries to keep
   * @returns Number of entries removed
   */
  async trimStream(maxLength: number): Promise<number> {
    try {
      const removed = await this.redis.xtrim(this.streamKey, 'MAXLEN', '~', maxLength);
      logger.debug(
        { stream: this.streamKey, maxLength, removed },
        'Trimmed stream'
      );
      return removed;
    } catch (err) {
      logger.error(
        { err, stream: this.streamKey },
        'Failed to trim stream'
      );
      throw err;
    }
  }

  /**
   * Start the event bus consumer loop
   * @param consumerName - Unique name for this consumer instance
   * @param pollIntervalMs - Interval between polls in milliseconds
   */
  async startConsumer(
    consumerName: string,
    pollIntervalMs: number = 1000
  ): Promise<void> {
    if (this.isRunning) {
      logger.warn('Event bus consumer is already running');
      return;
    }

    this.isRunning = true;
    await this.createConsumerGroup();

    logger.info(
      { consumerName, pollIntervalMs },
      'Started event bus consumer'
    );

    while (this.isRunning) {
      try {
        await this.processEvents(consumerName, 10);
      } catch (err) {
        logger.error({ err }, 'Error in event bus consumer loop');
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
  }

  /**
   * Stop the event bus consumer loop
   */
  stopConsumer(): void {
    this.isRunning = false;
    logger.info('Stopped event bus consumer');
  }
}

// Singleton instance for application-wide use
let eventBusInstance: EventBus | null = null;

/**
 * Get the singleton EventBus instance
 */
export function getEventBus(): EventBus {
  if (!eventBusInstance) {
    eventBusInstance = new EventBus();
  }
  return eventBusInstance;
}

/**
 * Publish an event to the event bus
 */
export async function publishEvent(event: DomainEvent): Promise<string> {
  return getEventBus().publish(event);
}

/**
 * Subscribe to event types
 */
export async function subscribeToEvents(
  eventTypes: string[],
  handler: EventHandler
): Promise<void> {
  return getEventBus().subscribe(eventTypes, handler);
}

// Re-export types and utilities from events module
export { createEvent, EventTypes, Aggregates } from './events.js';
export type { DomainEvent, EventPayload } from './events.js';
