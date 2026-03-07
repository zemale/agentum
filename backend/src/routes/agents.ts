import type { FastifyInstance } from 'fastify';
import {
  createAgent,
  getAgentById,
  listAgents,
  updateAgent,
  deleteAgent,
  rotateApiKey,
  updateIpWhitelist,
  getMyAgents,
  type AgentFilters,
} from '../services/agent.js';

export default async function agentRoutes(app: FastifyInstance) {
  // List agents (public)
  app.get('/', async (request, reply) => {
    const query = request.query as Record<string, string>;
    
    const filters: AgentFilters = {
      skills: query.skills?.split(',').filter(Boolean),
      minRating: query.minRating ? parseFloat(query.minRating) : undefined,
      isOnline: query.isOnline === 'true' ? true : query.isOnline === 'false' ? false : undefined,
      search: query.search,
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
    };

    const { agents, total } = await listAgents(filters);

    return reply.send({
      agents: agents.map((a: any) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        skills: a.skills,
        hourlyRate: a.hourlyRate,
        rating: a.rating,
        totalTasks: a.totalTasks,
        successRate: a.successRate,
        isOnline: a.isOnline,
        services: a.services,
      })),
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / (filters.limit || 20)),
      },
    });
  });

  // Get my agents (authenticated)
  app.get('/my', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const agents = await getMyAgents(userId);

    return reply.send({
      agents: agents.map((a: any) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        skills: a.skills,
        hourlyRate: a.hourlyRate,
        isOnline: a.isOnline,
        lastPollAt: a.lastPollAt,
        apiKey: a.apiKey,
        services: a.services,
        tasksCount: a._count.tasks,
      })),
    });
  });

  // Get agent by id (public)
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const agent = await getAgentById(id);

    if (!agent) {
      return reply.status(404).send({ error: 'Agent not found' });
    }

    return reply.send({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      skills: agent.skills,
      hourlyRate: agent.hourlyRate,
      rating: agent.rating,
      totalTasks: agent.totalTasks,
      successRate: agent.successRate,
      isOnline: agent.isOnline,
      services: agent.services,
      createdAt: agent.createdAt,
    });
  });

  // Create agent (authenticated)
  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const data = request.body as { name: string; description?: string; skills: string[]; hourlyRate: number };

    try {
      const agent = await createAgent(userId, data);
      return reply.status(201).send({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        skills: agent.skills,
        hourlyRate: agent.hourlyRate,
        apiKey: agent.apiKey,
        createdAt: agent.createdAt,
      });
    } catch (error) {
      return reply.status(400).send({ error: (error as Error).message });
    }
  });

  // Update agent (authenticated, owner only)
  app.put('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };
    const data = request.body as Partial<{ name: string; description: string; skills: string[]; hourlyRate: number }>;

    try {
      const agent = await updateAgent(id, userId, data);
      return reply.send({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        skills: agent.skills,
        hourlyRate: agent.hourlyRate,
      });
    } catch (error) {
      return reply.status(404).send({ error: (error as Error).message });
    }
  });

  // Delete agent (authenticated, owner only)
  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };

    try {
      await deleteAgent(id, userId);
      return reply.send({ success: true });
    } catch (error) {
      return reply.status(404).send({ error: (error as Error).message });
    }
  });

  // Rotate API key (authenticated, owner only)
  app.post('/:id/rotate-key', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };

    try {
      const newApiKey = await rotateApiKey(id, userId);
      return reply.send({ apiKey: newApiKey });
    } catch (error) {
      return reply.status(404).send({ error: (error as Error).message });
    }
  });

  // Update IP whitelist (authenticated, owner only)
  app.put('/:id/ip-whitelist', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };
    const { ips } = request.body as { ips: string[] };

    try {
      const agent = await updateIpWhitelist(id, userId, ips);
      return reply.send({ ipWhitelist: agent.ipWhitelist });
    } catch (error) {
      return reply.status(404).send({ error: (error as Error).message });
    }
  });
}
