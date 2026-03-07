/**
 * Task Service
 * 
 * Business logic for task management including:
 * - Creating tasks with escrow
 * - Task lifecycle (accept, progress, complete, approve)
 * - Task queries and filters
 */

import { prisma } from '../lib/prisma.js';
import { createEvent, EventTypes, Aggregates } from '../lib/events.js';
import { TaskStatus } from '@prisma/client';
import type { Prisma, Task } from '@prisma/client';

export interface CreateTaskData {
  customerId: string;
  agentId: string;
  serviceId?: string;
  title: string;
  description?: string;
  budget: number;
}

export interface TaskFilters {
  customerId?: string;
  agentId?: string;
  status?: TaskStatus;
  page?: number;
  limit?: number;
}

export interface TaskListResult {
  tasks: Task[];
  total: number;
  page: number;
  totalPages: number;
}

export interface CreateProgressData {
  taskId: string;
  agentId: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a new task with escrow lock via Outbox pattern
 */
export async function createTask(data: CreateTaskData): Promise<Task> {
  const { customerId, agentId, serviceId, title, description, budget } = data;

  // Verify customer has sufficient balance
  const customer = await prisma.user.findUnique({
    where: { id: customerId },
    select: { balance: true },
  });

  if (!customer) {
    throw new Error('Customer not found');
  }

  if (customer.balance < budget) {
    throw new Error('Insufficient balance');
  }

  // Verify agent exists
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { id: true, ownerId: true },
  });

  if (!agent) {
    throw new Error('Agent not found');
  }

  // Create task and outbox entry in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create the task
    const task = await tx.task.create({
      data: {
        customerId,
        agentId,
        serviceId,
        title,
        description,
        budget,
        status: TaskStatus.CREATED,
      },
    });

    // Create outbox entry for escrow lock
    const event = createEvent(
      EventTypes.ESCROW_LOCK,
      Aggregates.TASK,
      task.id,
      {
        taskId: task.id,
        userId: customerId,
        amount: budget,
        lockedAt: new Date().toISOString(),
        transactionId: crypto.randomUUID(),
      }
    );

    await tx.outbox.create({
      data: {
        aggregate: event.aggregate,
        aggregateId: event.aggregateId,
        type: event.type,
        payload: event.payload as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    });

    return task;
  });

  return result;
}

/**
 * Get task by ID with relations
 */
export async function getTaskById(
  taskId: string,
  options: { includeProgress?: boolean } = {}
): Promise<Task | null> {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      deletedAt: null,
    },
    include: {
      progress: options.includeProgress ?? false,
      customer: {
        select: { id: true, name: true, email: true },
      },
      agent: {
        select: { id: true, name: true, ownerId: true },
      },
      service: {
        select: { id: true, title: true, price: true },
      },
    },
  });

  return task;
}

/**
 * List tasks with filters and pagination
 */
export async function listTasks(filters: TaskFilters = {}): Promise<TaskListResult> {
  const { customerId, agentId, status, page = 1, limit = 20 } = filters;

  const where: Prisma.TaskWhereInput = {
    deletedAt: null,
  };

  if (customerId) {
    where.customerId = customerId;
  }

  if (agentId) {
    where.agentId = agentId;
  }

  if (status) {
    where.status = status;
  }

  const skip = (page - 1) * limit;

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: { id: true, name: true },
        },
        agent: {
          select: { id: true, name: true },
        },
        _count: {
          select: { progress: true },
        },
      },
    }),
    prisma.task.count({ where }),
  ]);

  return {
    tasks,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get my tasks (as customer or agent)
 */
export async function getMyTasks(
  userId: string,
  role: 'customer' | 'agent',
  filters: Omit<TaskFilters, 'customerId' | 'agentId'> = {}
): Promise<TaskListResult> {
  const agent = await prisma.agent.findFirst({
    where: { ownerId: userId },
    select: { id: true },
  });

  const agentId = agent?.id;

  if (role === 'customer') {
    return listTasks({ ...filters, customerId: userId });
  } else {
    if (!agentId) {
      return { tasks: [], total: 0, page: 1, totalPages: 0 };
    }
    return listTasks({ ...filters, agentId });
  }
}

/**
 * Agent accepts a task
 */
export async function acceptTask(taskId: string, agentId: string): Promise<Task> {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      agentId,
      deletedAt: null,
    },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  if (task.status !== TaskStatus.CREATED) {
    throw new Error(`Cannot accept task with status: ${task.status}`);
  }

  const updatedTask = await prisma.$transaction(async (tx) => {
    // Update task status
    const updated = await tx.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
    });

    // Create outbox entry for task assigned event
    const event = createEvent(
      EventTypes.TASK_ASSIGNED,
      Aggregates.TASK,
      taskId,
      {
        taskId,
        customerId: task.customerId,
        agentId,
        assignedAt: new Date().toISOString(),
      }
    );

    await tx.outbox.create({
      data: {
        aggregate: event.aggregate,
        aggregateId: event.aggregateId,
        type: event.type,
        payload: event.payload as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    });

    return updated;
  });

  return updatedTask;
}

/**
 * Agent declines a task (cancels it)
 */
export async function declineTask(taskId: string, agentId: string): Promise<Task> {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      agentId,
      deletedAt: null,
    },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  if (task.status !== TaskStatus.CREATED) {
    throw new Error(`Cannot decline task with status: ${task.status}`);
  }

  const updatedTask = await prisma.$transaction(async (tx) => {
    // Update task status
    const updated = await tx.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.CANCELLED,
      },
    });

    // Create outbox entry for escrow release (refund)
    const event = createEvent(
      EventTypes.ESCROW_RELEASE,
      Aggregates.TASK,
      taskId,
      {
        taskId,
        fromUserId: task.customerId,
        toUserId: task.customerId, // Refund to customer
        amount: task.budget,
        releasedAt: new Date().toISOString(),
        transactionId: crypto.randomUUID(),
      }
    );

    await tx.outbox.create({
      data: {
        aggregate: event.aggregate,
        aggregateId: event.aggregateId,
        type: event.type,
        payload: event.payload as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    });

    return updated;
  });

  return updatedTask;
}

/**
 * Start task (mark as in progress)
 */
export async function startTask(taskId: string, agentId: string): Promise<Task> {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      agentId,
      deletedAt: null,
    },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  if (task.status !== TaskStatus.ACCEPTED) {
    throw new Error(`Cannot start task with status: ${task.status}`);
  }

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: {
      status: TaskStatus.IN_PROGRESS,
    },
  });

  return updatedTask;
}

/**
 * Add progress log to task
 */
export async function addProgress(data: CreateProgressData) {
  const { taskId, agentId, message, metadata } = data;

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      agentId,
      deletedAt: null,
    },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  if (task.status !== TaskStatus.IN_PROGRESS && task.status !== TaskStatus.ACCEPTED) {
    throw new Error(`Cannot add progress to task with status: ${task.status}`);
  }

  const progress = await prisma.progress.create({
    data: {
      taskId,
      message,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });

  return progress;
}

/**
 * Get task progress logs
 */
export async function getTaskProgress(taskId: string) {
  const progress = await prisma.progress.findMany({
    where: { taskId },
    orderBy: { createdAt: 'asc' },
  });

  return progress;
}

/**
 * Complete task (submit result)
 */
export async function completeTask(
  taskId: string,
  agentId: string,
  result: string
): Promise<Task> {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      agentId,
      deletedAt: null,
    },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  if (task.status !== TaskStatus.IN_PROGRESS) {
    throw new Error(`Cannot complete task with status: ${task.status}`);
  }

  const autoCloseAt = new Date();
  autoCloseAt.setDate(autoCloseAt.getDate() + 7); // Auto-close after 7 days

  const updatedTask = await prisma.$transaction(async (tx) => {
    // Update task
    const updated = await tx.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.COMPLETED,
        result,
        completedAt: new Date(),
        autoCloseAt,
      },
    });

    // Create outbox entry for task completed event
    const event = createEvent(
      EventTypes.TASK_COMPLETED,
      Aggregates.TASK,
      taskId,
      {
        taskId,
        customerId: task.customerId,
        agentId,
        result,
        completedAt: new Date().toISOString(),
      }
    );

    await tx.outbox.create({
      data: {
        aggregate: event.aggregate,
        aggregateId: event.aggregateId,
        type: event.type,
        payload: event.payload as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    });

    return updated;
  });

  return updatedTask;
}

/**
 * Customer approves completed task (releases payment)
 */
export async function approveTask(
  taskId: string,
  customerId: string
): Promise<Task> {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      customerId,
      deletedAt: null,
    },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  if (task.status !== TaskStatus.COMPLETED) {
    throw new Error(`Cannot approve task with status: ${task.status}`);
  }

  const updatedTask = await prisma.$transaction(async (tx) => {
    // Update task status to CLOSED
    const updated = await tx.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.CLOSED,
      },
    });

    // Create outbox entry for escrow release (payment to agent)
    const releaseEvent = createEvent(
      EventTypes.ESCROW_RELEASE,
      Aggregates.TASK,
      taskId,
      {
        taskId,
        fromUserId: customerId,
        toUserId: task.agentId,
        amount: task.budget,
        releasedAt: new Date().toISOString(),
        transactionId: crypto.randomUUID(),
      }
    );

    await tx.outbox.create({
      data: {
        aggregate: releaseEvent.aggregate,
        aggregateId: releaseEvent.aggregateId,
        type: releaseEvent.type,
        payload: releaseEvent.payload as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    });

    // Create outbox entry for task approved event
    const approvedEvent = createEvent(
      EventTypes.TASK_APPROVED,
      Aggregates.TASK,
      taskId,
      {
        taskId,
        customerId,
        agentId: task.agentId,
        approvedAt: new Date().toISOString(),
        paymentAmount: task.budget,
      }
    );

    await tx.outbox.create({
      data: {
        aggregate: approvedEvent.aggregate,
        aggregateId: approvedEvent.aggregateId,
        type: approvedEvent.type,
        payload: approvedEvent.payload as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    });

    return updated;
  });

  return updatedTask;
}

/**
 * Open dispute for a task
 */
export async function openDispute(
  taskId: string,
  userId: string,
  reason: string
): Promise<Task> {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      deletedAt: null,
      OR: [
        { customerId: userId },
        { agent: { ownerId: userId } },
      ],
    },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  // Can only dispute COMPLETED tasks
  if (task.status !== TaskStatus.COMPLETED) {
    throw new Error(`Cannot open dispute for task with status: ${task.status}`);
  }

  const updatedTask = await prisma.$transaction(async (tx) => {
    // Create dispute
    await tx.dispute.create({
      data: {
        taskId,
        openedBy: userId,
        reason,
        status: 'OPEN',
      },
    });

    // Update task status
    const updated = await tx.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.DISPUTED,
      },
    });

    return updated;
  });

  return updatedTask;
}

/**
 * Auto-close tasks that have been in COMPLETED status for more than 7 days
 */
export async function autoCloseTasks(): Promise<number> {
  const now = new Date();

  const tasksToClose = await prisma.task.findMany({
    where: {
      status: TaskStatus.COMPLETED,
      autoCloseAt: {
        lte: now,
      },
    },
  });

  let closedCount = 0;

  for (const task of tasksToClose) {
    try {
      await prisma.$transaction(async (tx) => {
        // Update task status
        await tx.task.update({
          where: { id: task.id },
          data: {
            status: TaskStatus.CLOSED,
          },
        });

        // Create outbox entry for escrow release
        const event = createEvent(
          EventTypes.ESCROW_RELEASE,
          Aggregates.TASK,
          task.id,
          {
            taskId: task.id,
            fromUserId: task.customerId,
            toUserId: task.agentId,
            amount: task.budget,
            releasedAt: new Date().toISOString(),
            transactionId: crypto.randomUUID(),
          }
        );

        await tx.outbox.create({
          data: {
            aggregate: event.aggregate,
            aggregateId: event.aggregateId,
            type: event.type,
            payload: event.payload as Prisma.InputJsonValue,
            status: 'PENDING',
          },
        });
      });

      closedCount++;
    } catch (error) {
      console.error(`Failed to auto-close task ${task.id}:`, error);
    }
  }

  return closedCount;
}
