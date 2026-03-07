/**
 * Task Event Handler
 * 
 * Handles task-related events:
 * - Task assignment notifications
 * - Task completion notifications
 * - Task approval and payment processing
 * - Agent statistics updates
 */

import { prisma } from '@/lib/prisma.js';
import { logger } from '@/lib/logger.js';
import {
  type DomainEvent,
  EventTypes,
  type TaskAssignedPayload,
  type TaskCompletedPayload,
  type TaskApprovedPayload,
} from '@/lib/events.js';
import { type EventHandler } from './registry.js';

/**
 * Task Handler class
 * Handles task-related domain events
 */
export class TaskHandler implements EventHandler {
  /**
   * Handle a domain event related to tasks
   */
  async handle(event: DomainEvent): Promise<void> {
    switch (event.type) {
      case EventTypes.TASK_ASSIGNED:
        await this.handleTaskAssigned(event.payload as TaskAssignedPayload);
        break;

      case EventTypes.TASK_COMPLETED:
        await this.handleTaskCompleted(event.payload as TaskCompletedPayload);
        break;

      case EventTypes.TASK_APPROVED:
        await this.handleTaskApproved(event.payload as TaskApprovedPayload);
        break;

      default:
        // Not a task-related event
        break;
    }
  }

  /**
   * Handle task assigned event
   * Sends notification to agent
   */
  private async handleTaskAssigned(payload: TaskAssignedPayload): Promise<void> {
    try {
      logger.info(
        {
          taskId: payload.taskId,
          agentId: payload.agentId,
          customerId: payload.customerId,
        },
        'Task assigned to agent'
      );

      // TODO: Send SSE notification to agent
      // TODO: Send push notification if agent is offline
    } catch (err) {
      logger.error(
        { err, payload },
        'Failed to handle task assigned event'
      );
      throw err;
    }
  }

  /**
   * Handle task completed event
   * Sends notification to customer
   */
  private async handleTaskCompleted(payload: TaskCompletedPayload): Promise<void> {
    try {
      logger.info(
        {
          taskId: payload.taskId,
          agentId: payload.agentId,
          customerId: payload.customerId,
        },
        'Task completed by agent'
      );

      // TODO: Send SSE notification to customer
      // TODO: Send email notification
    } catch (err) {
      logger.error(
        { err, payload },
        'Failed to handle task completed event'
      );
      throw err;
    }
  }

  /**
   * Handle task approved event
   * Updates agent statistics
   */
  private async handleTaskApproved(payload: TaskApprovedPayload): Promise<void> {
    try {
      // Get task with agent info
      const task = await prisma.task.findUnique({
        where: { id: payload.taskId },
        include: {
          agent: true,
          _count: {
            select: {
              progress: true,
            },
          },
        },
      });

      if (!task) {
        throw new Error(`Task not found: ${payload.taskId}`);
      }

      // Update agent statistics
      await this.updateAgentStats(task.agentId);

      // Check for badge eligibility
      await this.checkBadges(task.agentId);

      logger.info(
        {
          taskId: payload.taskId,
          agentId: payload.agentId,
          paymentAmount: payload.paymentAmount,
        },
        'Task approved and agent stats updated'
      );
    } catch (err) {
      logger.error(
        { err, payload },
        'Failed to handle task approved event'
      );
      throw err;
    }
  }

  /**
   * Update agent statistics
   */
  private async updateAgentStats(agentId: string): Promise<void> {
    try {
      // Get all completed tasks for this agent
      const completedTasks = await prisma.task.findMany({
        where: {
          agentId,
          status: { in: ['COMPLETED', 'CLOSED'] },
        },
      });

      const totalTasks = completedTasks.length;

      // Calculate success rate (tasks that reached COMPLETED or CLOSED / total assigned)
      const assignedTasks = await prisma.task.count({
        where: {
          agentId,
          status: { not: 'CANCELLED' },
        },
      });

      const successRate = assignedTasks > 0 ? (totalTasks / assignedTasks) * 100 : 0;

      // Update agent
      await prisma.agent.update({
        where: { id: agentId },
        data: {
          totalTasks,
          successRate,
        },
      });

      logger.debug(
        { agentId, totalTasks, successRate },
        'Agent stats updated'
      );
    } catch (err) {
      logger.error(
        { err, agentId },
        'Failed to update agent stats'
      );
      throw err;
    }
  }

  /**
   * Check and award badges
   */
  private async checkBadges(agentId: string): Promise<void> {
    try {
      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        include: {
          badges: true,
        },
      });

      if (!agent) return;

      const existingBadgeTypes = new Set(agent.badges.map((b) => b.type));

      // Check task count badges
      const badgeThresholds = [
        { count: 10, type: '10_tasks', name: 'Novice' },
        { count: 50, type: '50_tasks', name: 'Expert' },
        { count: 100, type: '100_tasks', name: 'Master' },
      ];

      for (const threshold of badgeThresholds) {
        if (
          agent.totalTasks >= threshold.count &&
          !existingBadgeTypes.has(threshold.type)
        ) {
          await prisma.badge.create({
            data: {
              agentId,
              type: threshold.type,
            },
          });

          logger.info(
            { agentId, badgeType: threshold.type },
            'Badge awarded to agent'
          );
        }
      }

      // Check high rating badge (>4.5 with >10 reviews)
      if (agent.rating >= 4.5 && agent.totalTasks >= 10) {
        const ratingBadgeType = 'high_rating';
        if (!existingBadgeTypes.has(ratingBadgeType)) {
          await prisma.badge.create({
            data: {
              agentId,
              type: ratingBadgeType,
            },
          });

          logger.info(
            { agentId, badgeType: ratingBadgeType },
            'High rating badge awarded'
          );
        }
      }
    } catch (err) {
      logger.error(
        { err, agentId },
        'Failed to check badges'
      );
      throw err;
    }
  }
}
