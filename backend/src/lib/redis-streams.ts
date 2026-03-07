import { getRedisClient } from './redis.js';
import { logger } from './logger.js';

export interface StreamMessage {
  id: string;
  data: Record<string, string>;
}

/**
 * Add an entry to a Redis Stream
 * @param stream - Stream key name
 * @param data - Data object to add to the stream
 * @returns The ID of the added entry
 */
export async function addToStream(stream: string, data: object): Promise<string> {
  const client = getRedisClient();

  // Flatten the data object to key-value pairs for Redis
  const entries: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    entries.push(key, typeof value === 'string' ? value : JSON.stringify(value));
  }

  try {
    const id = await client.xadd(stream, '*', ...entries);
    if (!id) {
      throw new Error('Failed to add entry to stream - xadd returned null');
    }
    logger.debug({ stream, id }, 'Added entry to stream');
    return id;
  } catch (err) {
    logger.error({ err, stream }, 'Failed to add entry to stream');
    throw err;
  }
}

/**
 * Read entries from a Redis Stream
 * @param stream - Stream key name
 * @param lastId - Last ID to read from (default: '0' for all, '$' for new only)
 * @param count - Maximum number of entries to read (default: 100)
 * @returns Array of stream messages
 */
export async function readFromStream(
  stream: string,
  lastId: string = '0',
  count: number = 100
): Promise<StreamMessage[]> {
  const client = getRedisClient();

  try {
    const result = await client.xread('COUNT', count, 'STREAMS', stream, lastId);

    if (!result || result.length === 0) {
      return [];
    }

    const messages: StreamMessage[] = [];

    // result format: [[streamKey, [[id, [key, value, ...]], ...]]]
    for (const streamData of result) {
      const [, streamEntries] = streamData as [string, Array<[string, string[]]>];

      for (const [id, fields] of streamEntries) {
        const data: Record<string, string> = {};
        for (let i = 0; i < fields.length; i += 2) {
          data[fields[i]] = fields[i + 1];
        }
        messages.push({ id, data });
      }
    }

    return messages;
  } catch (err) {
    logger.error({ err, stream }, 'Failed to read from stream');
    throw err;
  }
}

/**
 * Create a consumer group for a stream
 * @param stream - Stream key name
 * @param group - Consumer group name
 * @param startId - Start ID (default: '0' for beginning, '$' for new entries only)
 */
export async function createConsumerGroup(
  stream: string,
  group: string,
  startId: string = '0'
): Promise<void> {
  const client = getRedisClient();

  try {
    await client.xgroup('CREATE', stream, group, startId, 'MKSTREAM');
    logger.info({ stream, group }, 'Created consumer group');
  } catch (err) {
    // Group already exists - not an error
    if (err instanceof Error && err.message.includes('already exists')) {
      logger.debug({ stream, group }, 'Consumer group already exists');
      return;
    }
    logger.error({ err, stream, group }, 'Failed to create consumer group');
    throw err;
  }
}

/**
 * Read from a stream as part of a consumer group
 * @param stream - Stream key name
 * @param group - Consumer group name
 * @param consumer - Consumer name (unique identifier for this instance)
 * @param count - Maximum number of entries to read (default: 10)
 * @param blockMs - Block for milliseconds waiting for new messages (default: 5000, 0 for no block)
 * @returns Array of stream messages
 */
export async function readGroup(
  stream: string,
  group: string,
  consumer: string,
  count: number = 10,
  blockMs: number = 5000
): Promise<StreamMessage[]> {
  const client = getRedisClient();

  try {
    const args: (string | number)[] = [
      'GROUP',
      group,
      consumer,
      'COUNT',
      count,
    ];

    if (blockMs > 0) {
      args.push('BLOCK', blockMs);
    }

    args.push('STREAMS', stream, '>');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (client.xreadgroup as any)(...args);

    if (!result || result.length === 0) {
      return [];
    }

    const messages: StreamMessage[] = [];

    for (const streamData of result) {
      const [, streamEntries] = streamData as [string, Array<[string, string[]]>];

      for (const [id, fields] of streamEntries) {
        const data: Record<string, string> = {};
        for (let i = 0; i < fields.length; i += 2) {
          data[fields[i]] = fields[i + 1];
        }
        messages.push({ id, data });
      }
    }

    return messages;
  } catch (err) {
    logger.error({ err, stream, group, consumer }, 'Failed to read from consumer group');
    throw err;
  }
}

/**
 * Acknowledge a message in a consumer group
 * @param stream - Stream key name
 * @param group - Consumer group name
 * @param messageId - Message ID to acknowledge
 */
export async function acknowledgeMessage(
  stream: string,
  group: string,
  messageId: string
): Promise<number> {
  const client = getRedisClient();

  try {
    const acked = await client.xack(stream, group, messageId);
    logger.debug({ stream, group, messageId }, 'Acknowledged message');
    return acked;
  } catch (err) {
    logger.error({ err, stream, group, messageId }, 'Failed to acknowledge message');
    throw err;
  }
}

/**
 * Get pending messages info for a consumer group
 * @param stream - Stream key name
 * @param group - Consumer group name
 * @returns Pending messages summary
 */
export async function getPendingMessages(
  stream: string,
  group: string
): Promise<{
  count: number;
  minId: string | null;
  maxId: string | null;
  consumers: Array<{ name: string; count: number }>;
}> {
  const client = getRedisClient();

  try {
    const result = await client.xpending(stream, group);

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
    logger.error({ err, stream, group }, 'Failed to get pending messages');
    throw err;
  }
}

/**
 * Trim a stream to a maximum length
 * @param stream - Stream key name
 * @param maxLength - Maximum number of entries to keep
 * @returns Number of entries removed
 */
export async function trimStream(stream: string, maxLength: number): Promise<number> {
  const client = getRedisClient();

  try {
    const removed = await client.xtrim(stream, 'MAXLEN', '~', maxLength);
    logger.debug({ stream, maxLength, removed }, 'Trimmed stream');
    return removed;
  } catch (err) {
    logger.error({ err, stream }, 'Failed to trim stream');
    throw err;
  }
}

/**
 * Delete a stream
 * @param stream - Stream key name
 * @returns Number of entries deleted
 */
export async function deleteStream(stream: string): Promise<number> {
  const client = getRedisClient();

  try {
    const deleted = await client.del(stream);
    logger.info({ stream }, 'Deleted stream');
    return deleted;
  } catch (err) {
    logger.error({ err, stream }, 'Failed to delete stream');
    throw err;
  }
}
