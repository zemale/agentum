/**
 * Event Handlers Registry
 * 
 * Central registry for event handlers. Allows registering handlers
 * for specific event types and dispatching events to all registered handlers.
 */

import { logger } from '@/lib/logger.js';
import { type DomainEvent, EventTypes } from '@/lib/events.js';

/**
 * Event handler interface
 */
export interface EventHandler {
  /**
   * Handle an event
   * @param event - The domain event to handle
   */
  handle(event: DomainEvent): Promise<void>;
}

/**
 * Event handler function type
 */
export type EventHandlerFunction = (event: DomainEvent) => Promise<void>;

/**
 * Handlers Registry class
 * Manages registration and dispatching of event handlers
 */
export class HandlersRegistry {
  private handlers: Map<string, Array<EventHandler | EventHandlerFunction>> = new Map();

  /**
   * Register a handler for one or more event types
   * @param eventTypes - Array of event types to handle
   * @param handler - Handler instance or function
   */
  register(
    eventTypes: string[],
    handler: EventHandler | EventHandlerFunction
  ): void {
    for (const eventType of eventTypes) {
      const existing = this.handlers.get(eventType) || [];
      existing.push(handler);
      this.handlers.set(eventType, existing);

      logger.debug(
        { eventType, handlerCount: existing.length },
        'Registered event handler'
      );
    }
  }

  /**
   * Register a single handler for a single event type
   * @param eventType - Event type to handle
   * @param handler - Handler instance or function
   */
  registerOne(
    eventType: string,
    handler: EventHandler | EventHandlerFunction
  ): void {
    this.register([eventType], handler);
  }

  /**
   * Dispatch an event to all registered handlers
   * @param event - The domain event to dispatch
   */
  async dispatch(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) || [];

    if (handlers.length === 0) {
      logger.debug(
        { eventType: event.type, aggregateId: event.aggregateId },
        'No handlers registered for event type'
      );
      return;
    }

    logger.debug(
      { eventType: event.type, handlerCount: handlers.length },
      'Dispatching event to handlers'
    );

    const errors: Error[] = [];

    for (const handler of handlers) {
      try {
        if (typeof handler === 'function') {
          await handler(event);
        } else {
          await handler.handle(event);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        errors.push(error);
        logger.error(
          { err: error, eventType: event.type },
          'Event handler failed'
        );
        // Continue with other handlers even if one fails
      }
    }

    if (errors.length > 0) {
      logger.warn(
        { eventType: event.type, errorCount: errors.length },
        'Some event handlers failed'
      );
    }
  }

  /**
   * Get all registered handlers for an event type
   * @param eventType - The event type
   * @returns Array of handlers
   */
  getHandlers(eventType: string): Array<EventHandler | EventHandlerFunction> {
    return this.handlers.get(eventType) || [];
  }

  /**
   * Check if any handlers are registered for an event type
   * @param eventType - The event type
   * @returns True if handlers are registered
   */
  hasHandlers(eventType: string): boolean {
    const handlers = this.handlers.get(eventType);
    return handlers !== undefined && handlers.length > 0;
  }

  /**
   * Unregister all handlers for an event type
   * @param eventType - The event type
   */
  unregisterAll(eventType: string): void {
    this.handlers.delete(eventType);
    logger.debug({ eventType }, 'Unregistered all handlers for event type');
  }

  /**
   * Clear all registered handlers
   */
  clear(): void {
    this.handlers.clear();
    logger.debug('Cleared all event handlers');
  }

  /**
   * Get all registered event types
   * @returns Array of event types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get handler statistics
   * @returns Object with event types and handler counts
   */
  getStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [type, handlers] of this.handlers.entries()) {
      stats[type] = handlers.length;
    }
    return stats;
  }
}

// Singleton instance
let registryInstance: HandlersRegistry | null = null;

/**
 * Get or create the singleton handlers registry instance
 */
export function getHandlersRegistry(): HandlersRegistry {
  if (!registryInstance) {
    registryInstance = new HandlersRegistry();
  }
  return registryInstance;
}

/**
 * Register default handlers for the application
 * This should be called during application startup
 */
export async function registerDefaultHandlers(): Promise<void> {
  const registry = getHandlersRegistry();

  // Import and register notification handler
  const { NotificationHandler } = await import('./notification.js');
  const notificationHandler = new NotificationHandler();
  registry.register(Object.values(EventTypes), notificationHandler);

  // Import and register audit handler
  const { AuditHandler } = await import('./audit.js');
  const auditHandler = new AuditHandler();
  registry.register(Object.values(EventTypes), auditHandler);

  // Import and register wallet handler
  const { WalletHandler } = await import('./wallet.js');
  const walletHandler = new WalletHandler();
  registry.register(
    [EventTypes.ESCROW_LOCK, EventTypes.ESCROW_RELEASE, EventTypes.PAYMENT],
    walletHandler
  );

  // Import and register task handler
  const { TaskHandler } = await import('./task.js');
  const taskHandler = new TaskHandler();
  registry.register(
    [EventTypes.TASK_ASSIGNED, EventTypes.TASK_COMPLETED, EventTypes.TASK_APPROVED],
    taskHandler
  );

  logger.info(
    { registeredTypes: registry.getRegisteredTypes() },
    'Default event handlers registered'
  );
}
