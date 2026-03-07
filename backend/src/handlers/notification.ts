/**
 * Notification Handler
 * 
 * Sends real-time notifications to users via Server-Sent Events (SSE)
 * or other notification channels when domain events occur.
 */

import { logger } from '@/lib/logger.js';
import { type DomainEvent, EventTypes, type EventPayload } from '@/lib/events.js';
import { type EventHandler } from './registry.js';

// In-memory store for SSE connections (in production, use Redis Pub/Sub)
// Map of userId -> array of send functions
const sseConnections = new Map<string, Array<(data: string) => void>>();

/**
 * Notification payload sent to clients
 */
interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Notification Handler class
 * Handles sending notifications for domain events
 */
export class NotificationHandler implements EventHandler {
  /**
   * Handle a domain event by sending appropriate notifications
   */
  async handle(event: DomainEvent): Promise<void> {
    const notification = this.createNotification(event);
    
    if (!notification) {
      return;
    }

    // Determine target users based on event type
    const targetUserIds = this.getTargetUsers(event);

    // Send notifications to connected users
    for (const userId of targetUserIds) {
      await this.sendNotification(userId, notification);
    }

    logger.debug(
      { 
        eventType: event.type, 
        targetUsers: targetUserIds.length,
        notificationType: notification.type 
      },
      'Sent notifications'
    );
  }

  /**
   * Create a notification from a domain event
   */
  private createNotification(event: DomainEvent): NotificationPayload | null {
    const baseNotification = {
      id: `${event.type}-${Date.now()}`,
      timestamp: event.metadata?.timestamp || new Date().toISOString(),
    };

    switch (event.type) {
      case EventTypes.USER_REGISTERED:
        return {
          ...baseNotification,
          type: 'success',
          title: 'Welcome!',
          message: 'Your account has been created successfully.',
          data: { userId: (event.payload as EventPayload & { userId: string }).userId },
        };

      case EventTypes.TASK_CREATED:
        return {
          ...baseNotification,
          type: 'info',
          title: 'New Task Created',
          message: `Task "${(event.payload as EventPayload & { title: string }).title}" has been created.`,
          data: { taskId: event.aggregateId },
        };

      case EventTypes.TASK_ASSIGNED:
        return {
          ...baseNotification,
          type: 'info',
          title: 'Task Assigned',
          message: 'A task has been assigned to an agent.',
          data: { taskId: event.aggregateId },
        };

      case EventTypes.TASK_COMPLETED:
        return {
          ...baseNotification,
          type: 'success',
          title: 'Task Completed',
          message: 'A task has been marked as completed.',
          data: { taskId: event.aggregateId },
        };

      case EventTypes.TASK_APPROVED:
        return {
          ...baseNotification,
          type: 'success',
          title: 'Task Approved',
          message: 'Your task has been approved and payment processed.',
          data: { 
            taskId: event.aggregateId,
            paymentAmount: (event.payload as EventPayload & { paymentAmount: number }).paymentAmount,
          },
        };

      case EventTypes.ESCROW_LOCK:
        return {
          ...baseNotification,
          type: 'info',
          title: 'Funds Locked',
          message: `Funds have been locked in escrow for task.`,
          data: { 
            taskId: event.aggregateId,
            amount: (event.payload as EventPayload & { amount: number }).amount,
          },
        };

      case EventTypes.ESCROW_RELEASE:
        return {
          ...baseNotification,
          type: 'success',
          title: 'Funds Released',
          message: 'Escrow funds have been released.',
          data: { 
            taskId: event.aggregateId,
            amount: (event.payload as EventPayload & { amount: number }).amount,
          },
        };

      case EventTypes.PAYMENT:
        return {
          ...baseNotification,
          type: 'success',
          title: 'Payment Received',
          message: 'You have received a payment.',
          data: { 
            amount: (event.payload as EventPayload & { amount: number }).amount,
            paymentId: (event.payload as EventPayload & { paymentId: string }).paymentId,
          },
        };

      case EventTypes.REVIEW_CREATED:
        return {
          ...baseNotification,
          type: 'info',
          title: 'New Review',
          message: 'You have received a new review.',
          data: { 
            reviewId: event.aggregateId,
            rating: (event.payload as EventPayload & { rating: number }).rating,
          },
        };

      case EventTypes.AGENT_CREATED:
        return {
          ...baseNotification,
          type: 'success',
          title: 'Agent Created',
          message: `Agent "${(event.payload as EventPayload & { name: string }).name}" has been created successfully.`,
          data: { agentId: event.aggregateId },
        };

      default:
        return null;
    }
  }

  /**
   * Get target user IDs for a notification
   */
  private getTargetUsers(event: DomainEvent): string[] {
    const userIds: string[] = [];

    switch (event.type) {
      case EventTypes.USER_REGISTERED:
        userIds.push((event.payload as EventPayload & { userId: string }).userId);
        break;

      case EventTypes.TASK_CREATED:
        userIds.push(
          (event.payload as EventPayload & { customerId: string }).customerId
        );
        break;

      case EventTypes.TASK_ASSIGNED:
      case EventTypes.TASK_COMPLETED:
      case EventTypes.TASK_APPROVED:
        const taskPayload = event.payload as EventPayload & { customerId: string; agentId: string };
        userIds.push(taskPayload.customerId, taskPayload.agentId);
        break;

      case EventTypes.ESCROW_LOCK:
        userIds.push(
          (event.payload as EventPayload & { userId: string }).userId
        );
        break;

      case EventTypes.ESCROW_RELEASE:
        const releasePayload = event.payload as EventPayload & { fromUserId: string; toUserId: string };
        userIds.push(releasePayload.fromUserId, releasePayload.toUserId);
        break;

      case EventTypes.PAYMENT:
        const paymentPayload = event.payload as EventPayload & { fromUserId?: string; toUserId: string };
        if (paymentPayload.fromUserId) {
          userIds.push(paymentPayload.fromUserId);
        }
        userIds.push(paymentPayload.toUserId);
        break;

      case EventTypes.REVIEW_CREATED:
        const reviewPayload = event.payload as EventPayload & { agentId: string; customerId: string };
        userIds.push(reviewPayload.agentId, reviewPayload.customerId);
        break;

      case EventTypes.AGENT_CREATED:
        userIds.push(
          (event.payload as EventPayload & { ownerId: string }).ownerId
        );
        break;
    }

    return [...new Set(userIds)]; // Remove duplicates
  }

  /**
   * Send a notification to a user
   */
  private async sendNotification(
    userId: string,
    notification: NotificationPayload
  ): Promise<void> {
    const connections = sseConnections.get(userId);
    
    if (!connections || connections.length === 0) {
      // User not connected - notification could be queued for later
      logger.debug(
        { userId, notificationId: notification.id },
        'User not connected, notification skipped'
      );
      return;
    }

    const data = JSON.stringify({
      event: 'notification',
      data: notification,
    });

    // Send to all connected clients for this user
    for (const send of connections) {
      try {
        send(data);
      } catch (err) {
        logger.error({ err, userId }, 'Failed to send SSE notification');
      }
    }
  }
}

/**
 * Register an SSE connection for a user
 * @param userId - The user ID
 * @param send - Function to send data to the client
 * @returns Function to unregister the connection
 */
export function registerSSEConnection(
  userId: string,
  send: (data: string) => void
): () => void {
  const connections = sseConnections.get(userId) || [];
  connections.push(send);
  sseConnections.set(userId, connections);

  logger.debug({ userId, connectionCount: connections.length }, 'Registered SSE connection');

  // Return unregister function
  return () => {
    const conns = sseConnections.get(userId) || [];
    const index = conns.indexOf(send);
    if (index > -1) {
      conns.splice(index, 1);
      if (conns.length === 0) {
        sseConnections.delete(userId);
      } else {
        sseConnections.set(userId, conns);
      }
    }
    logger.debug({ userId, connectionCount: conns.length }, 'Unregistered SSE connection');
  };
}

/**
 * Get connected user count (for metrics)
 */
export function getConnectedUserCount(): number {
  return sseConnections.size;
}
