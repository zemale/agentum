import { Redis, type RedisOptions } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

// Connection configuration from environment
const REDIS_URL = env.REDIS_URL;

// Redis client options with reconnection logic
const clientOptions: RedisOptions = {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    logger.info(`Redis reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  },
  reconnectOnError(err: Error) {
    const targetErrors = ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'READONLY'];
    const shouldReconnect = targetErrors.some(e => err.message.includes(e));
    if (shouldReconnect) {
      logger.warn(`Redis reconnecting due to error: ${err.message}`);
    }
    return shouldReconnect;
  },
};

// Main Redis client for general operations
let mainClient: Redis | null = null;

// Pub/Sub clients (separate instances required for pub/sub)
let publisherClient: Redis | null = null;
let subscriberClient: Redis | null = null;

/**
 * Get the main Redis client instance (singleton)
 * Used for commands: GET, SET, streams, etc.
 */
export function getRedisClient(): Redis {
  if (!mainClient) {
    mainClient = new Redis(REDIS_URL, clientOptions);

    mainClient.on('error', (err) => {
      logger.error({ err }, 'Redis main client error');
    });

    mainClient.on('connect', () => {
      logger.info('Redis main client connected');
    });

    mainClient.on('ready', () => {
      logger.info('Redis main client ready');
    });

    mainClient.on('reconnecting', () => {
      logger.info('Redis main client reconnecting...');
    });

    mainClient.on('close', () => {
      logger.info('Redis main client connection closed');
    });
  }

  return mainClient;
}

/**
 * Get the Redis publisher client instance (singleton)
 * Used for publishing messages
 */
export function getPublisherClient(): Redis {
  if (!publisherClient) {
    publisherClient = new Redis(REDIS_URL, clientOptions);

    publisherClient.on('error', (err) => {
      logger.error({ err }, 'Redis publisher error');
    });

    publisherClient.on('connect', () => {
      logger.info('Redis publisher connected');
    });
  }

  return publisherClient;
}

/**
 * Get the Redis subscriber client instance (singleton)
 * Used for subscribing to channels
 */
export function getSubscriberClient(): Redis {
  if (!subscriberClient) {
    subscriberClient = new Redis(REDIS_URL, clientOptions);

    subscriberClient.on('error', (err) => {
      logger.error({ err }, 'Redis subscriber error');
    });

    subscriberClient.on('connect', () => {
      logger.info('Redis subscriber connected');
    });
  }

  return subscriberClient;
}

/**
 * Connect all Redis clients
 * Call this on application startup
 */
export async function connectRedis(): Promise<void> {
  const main = getRedisClient();
  const pub = getPublisherClient();
  const sub = getSubscriberClient();

  // Connect main client
  if (main.status === 'wait') {
    await main.connect();
  }

  // Connect publisher
  if (pub.status === 'wait') {
    await pub.connect();
  }

  // Connect subscriber
  if (sub.status === 'wait') {
    await sub.connect();
  }

  logger.info('All Redis clients connected');
}

/**
 * Health check for Redis connection
 * @returns Object with status and latency information
 */
export async function healthCheck(): Promise<{
  status: 'ok' | 'error';
  latency?: number;
  message?: string;
}> {
  const client = getRedisClient();

  try {
    const start = Date.now();
    const pong = await client.ping();
    const latency = Date.now() - start;

    if (pong === 'PONG') {
      return { status: 'ok', latency };
    }

    return { status: 'error', message: 'Unexpected response from Redis' };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Close all Redis connections gracefully
 * Call this on application shutdown
 */
export async function disconnectRedis(): Promise<void> {
  logger.info('Closing all Redis connections...');

  if (mainClient) {
    await mainClient.quit();
    mainClient = null;
    logger.info('Redis main client disconnected');
  }

  if (publisherClient) {
    await publisherClient.quit();
    publisherClient = null;
    logger.info('Redis publisher disconnected');
  }

  if (subscriberClient) {
    await subscriberClient.quit();
    subscriberClient = null;
    logger.info('Redis subscriber disconnected');
  }
}
