import type { FastifyInstance } from 'fastify';
import {
  createTask,
  getTaskById,
  listTasks,
  getMyTasks,
  acceptTask,
  declineTask,
  startTask,
  addProgress,
  getTaskProgress,
  completeTask,
  approveTask,
  openDispute,
  type CreateTaskData,
  type TaskFilters,
} from '../services/task.js';

export default async function taskRoutes(app: FastifyInstance) {
  // List tasks (public marketplace)
  app.get('/', async (request, reply) => {
    const query = request.query as Record<string, string>;

    const filters: TaskFilters = {
      status: query.status as TaskFilters['status'],
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
    };

    const { tasks, total, page, totalPages } = await listTasks(filters);

    return reply.send({
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        budget: t.budget,
        status: t.status,
        customer: (t as any).customer,
        agent: (t as any).agent,
        progressCount: (t as any)._count?.progress || 0,
        createdAt: t.createdAt,
      })),
      pagination: {
        page,
        limit: filters.limit,
        total,
        totalPages,
      },
    });
  });

  // Get my tasks (as customer or agent)
  app.get('/my', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const query = request.query as Record<string, string>;

    const role = (query.role as 'customer' | 'agent') || 'customer';
    const filters: TaskFilters = {
      status: query.status as TaskFilters['status'],
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
    };

    const { tasks, total, page, totalPages } = await getMyTasks(userId, role, filters);

    return reply.send({
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        budget: t.budget,
        status: t.status,
        customer: (t as any).customer,
        agent: (t as any).agent,
        progressCount: (t as any)._count?.progress || 0,
        createdAt: t.createdAt,
        acceptedAt: t.acceptedAt,
        completedAt: t.completedAt,
      })),
      pagination: {
        page,
        limit: filters.limit,
        total,
        totalPages,
      },
    });
  });

  // Get task by ID (authenticated - must be participant)
  app.get('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };

    const task = await getTaskById(id, { includeProgress: true });

    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }

    // Check if user is customer or agent owner
    const isCustomer = task.customerId === userId;
    const isAgentOwner = (task as any).agent?.ownerId === userId;

    if (!isCustomer && !isAgentOwner) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    return reply.send({
      id: task.id,
      title: task.title,
      description: task.description,
      budget: task.budget,
      status: task.status,
      result: task.result,
      customer: (task as any).customer,
      agent: (task as any).agent,
      service: (task as any).service,
      progress: (task as any).progress || [],
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      acceptedAt: task.acceptedAt,
      completedAt: task.completedAt,
      autoCloseAt: task.autoCloseAt,
    });
  });

  // Create new task (customer only)
  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const data = request.body as CreateTaskData;

    try {
      const task = await createTask({
        ...data,
        customerId: userId,
      });

      return reply.status(201).send({
        id: task.id,
        title: task.title,
        description: task.description,
        budget: task.budget,
        status: task.status,
        agentId: task.agentId,
        serviceId: task.serviceId,
        createdAt: task.createdAt,
      });
    } catch (error) {
      const message = (error as Error).message;
      if (message === 'Insufficient balance') {
        return reply.status(400).send({ error: 'Insufficient balance', code: 'INSUFFICIENT_BALANCE' });
      }
      return reply.status(400).send({ error: message });
    }
  });

  // Get task progress (authenticated - must be participant)
  app.get('/:id/progress', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };

    const task = await getTaskById(id);

    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }

    // Check if user is customer or agent owner
    const isCustomer = task.customerId === userId;
    const isAgentOwner = (task as any).agent?.ownerId === userId;

    if (!isCustomer && !isAgentOwner) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    const progress = await getTaskProgress(id);

    return reply.send({ progress });
  });

  // === Agent-only endpoints ===

  // Accept task (agent only)
  app.post('/:id/accept', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };

    // Get agent for this user
    const { getAgentByOwner } = await import('../services/agent.js');
    const agent = await getAgentByOwner(userId);

    if (!agent) {
      return reply.status(403).send({ error: 'You must be an agent to accept tasks' });
    }

    try {
      const task = await acceptTask(id, agent.id);
      return reply.send({
        id: task.id,
        status: task.status,
        acceptedAt: task.acceptedAt,
      });
    } catch (error) {
      return reply.status(400).send({ error: (error as Error).message });
    }
  });

  // Decline task (agent only)
  app.post('/:id/decline', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };

    const { getAgentByOwner } = await import('../services/agent.js');
    const agent = await getAgentByOwner(userId);

    if (!agent) {
      return reply.status(403).send({ error: 'You must be an agent to decline tasks' });
    }

    try {
      const task = await declineTask(id, agent.id);
      return reply.send({
        id: task.id,
        status: task.status,
      });
    } catch (error) {
      return reply.status(400).send({ error: (error as Error).message });
    }
  });

  // Start task (agent only)
  app.post('/:id/start', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };

    const { getAgentByOwner } = await import('../services/agent.js');
    const agent = await getAgentByOwner(userId);

    if (!agent) {
      return reply.status(403).send({ error: 'You must be an agent to start tasks' });
    }

    try {
      const task = await startTask(id, agent.id);
      return reply.send({
        id: task.id,
        status: task.status,
      });
    } catch (error) {
      return reply.status(400).send({ error: (error as Error).message });
    }
  });

  // Add progress (agent only)
  app.post('/:id/progress', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };
    const { message, metadata } = request.body as { message: string; metadata?: Record<string, unknown> };

    const { getAgentByOwner } = await import('../services/agent.js');
    const agent = await getAgentByOwner(userId);

    if (!agent) {
      return reply.status(403).send({ error: 'You must be an agent to add progress' });
    }

    try {
      const progress = await addProgress({
        taskId: id,
        agentId: agent.id,
        message,
        metadata,
      });

      return reply.status(201).send({
        id: progress.id,
        message: progress.message,
        metadata: progress.metadata,
        createdAt: progress.createdAt,
      });
    } catch (error) {
      return reply.status(400).send({ error: (error as Error).message });
    }
  });

  // Complete task (agent only)
  app.post('/:id/complete', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };
    const { result } = request.body as { result: string };

    const { getAgentByOwner } = await import('../services/agent.js');
    const agent = await getAgentByOwner(userId);

    if (!agent) {
      return reply.status(403).send({ error: 'You must be an agent to complete tasks' });
    }

    try {
      const task = await completeTask(id, agent.id, result);
      return reply.send({
        id: task.id,
        status: task.status,
        result: task.result,
        completedAt: task.completedAt,
        autoCloseAt: task.autoCloseAt,
      });
    } catch (error) {
      return reply.status(400).send({ error: (error as Error).message });
    }
  });

  // Approve task (customer only)
  app.post('/:id/approve', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };

    try {
      const task = await approveTask(id, userId);
      return reply.send({
        id: task.id,
        status: task.status,
      });
    } catch (error) {
      return reply.status(400).send({ error: (error as Error).message });
    }
  });

  // Open dispute (customer or agent)
  app.post('/:id/dispute', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };
    const { reason } = request.body as { reason: string };

    if (!reason || reason.trim().length < 10) {
      return reply.status(400).send({ error: 'Reason must be at least 10 characters' });
    }

    try {
      const task = await openDispute(id, userId, reason);
      return reply.send({
        id: task.id,
        status: task.status,
      });
    } catch (error) {
      return reply.status(400).send({ error: (error as Error).message });
    }
  });
}
