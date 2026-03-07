import { getPublisherClient, getSubscriberClient } from './redis.js';
import { logger } from './logger.js';

// Track active subscriptions for cleanup
const activeSubscriptions = new Map<string, Set<(message: any) => void>>();

/**
 * Publish a message to a Redis Pub/Sub channel
 * @param channel - Channel name to publish to
 * @param message - Message object to publish (will be JSON serialized)
 */
export async function publish(channel: string, message: object): Promise<void> {
  const publisher = getPublisherClient();
  const serializedMessage = JSON.stringify(message);

  try {
    await publisher.publish(channel, serializedMessage);
    logger.debug({ channel }, 'Message published to channel');
  } catch (err) {
    logger.error({ err, channel }, 'Failed to publish message');
    throw err;
  }
}

/**
 * Subscribe to a Redis Pub/Sub channel
 * @param channel - Channel name to subscribe to
 * @param callback - Callback function that receives the parsed message
 */
export async function subscribe(
  channel: string,
  callback: (message: any) => void
): Promise<void> {
  const subscriber = getSubscriberClient();

  // Track this callback for the channel
  if (!activeSubscriptions.has(channel)) {
    activeSubscriptions.set(channel, new Set());

    // Set up message handler for this channel (only once per channel)
    subscriber.on('message', (receivedChannel: string, message: string) => {
      if (receivedChannel === channel) {
        try {
          const parsedMessage = JSON.parse(message);
          const callbacks = activeSubscriptions.get(channel);
          if (callbacks) {
            callbacks.forEach((cb) => {
              try {
                cb(parsedMessage);
              } catch (cbErr) {
                logger.error({ err: cbErr, channel }, 'Error in subscription callback');
              }
            });
          }
        } catch (err) {
          logger.error({ err, channel, message }, 'Failed to parse message');
        }
      }
    });

    // Subscribe to the channel
    await subscriber.subscribe(channel);
    logger.info({ channel }, 'Subscribed to channel');
  }

  // Add callback to the set
  activeSubscriptions.get(channel)!.add(callback);
}

/**
 * Unsubscribe from a Redis Pub/Sub channel
 * @param channel - Channel name to unsubscribe from
 * @param callback - Optional specific callback to remove. If not provided, removes all callbacks for the channel.
 */
export async function unsubscribe(
  channel: string,
  callback?: (message: any) => void
): Promise<void> {
  const subscriber = getSubscriberClient();
  const callbacks = activeSubscriptions.get(channel);

  if (!callbacks) {
    return;
  }

  if (callback) {
    // Remove specific callback
    callbacks.delete(callback);
  } else {
    // Remove all callbacks
    callbacks.clear();
  }

  // If no more callbacks for this channel, unsubscribe from Redis
  if (callbacks.size === 0) {
    await subscriber.unsubscribe(channel);
    activeSubscriptions.delete(channel);
    logger.info({ channel }, 'Unsubscribed from channel');
  }
}

/**
 * Get list of active subscriptions
 * @returns Array of channel names with active subscriptions
 */
export function getActiveSubscriptions(): string[] {
  return Array.from(activeSubscriptions.keys());
}

/**
 * Unsubscribe from all channels
 * Call this during graceful shutdown
 */
export async function unsubscribeAll(): Promise<void> {
  const subscriber = getSubscriberClient();
  const channels = Array.from(activeSubscriptions.keys());

  if (channels.length > 0) {
    await subscriber.unsubscribe(...channels);
    activeSubscriptions.clear();
    logger.info('Unsubscribed from all channels');
  }
}
