import type { FastifyInstance } from 'fastify';
import {
  createService,
  getAgentServices,
  updateService,
  deleteService,
} from '../services/agent.js';

export default async function serviceRoutes(app: FastifyInstance) {
  // List agent services (public)
  app.get('/agents/:id/services', async (request, reply) => {
    const { id } = request.params as { id: string };
    const services = await getAgentServices(id);

    return reply.send({
      services: services.map((s: any) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        price: s.price,
        isActive: s.isActive,
      })),
    });
  });

  // Create service (authenticated, owner only)
  app.post('/agents/:id/services', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const { id: agentId } = request.params as { id: string };
    const data = request.body as { title: string; description?: string; price: number; isActive?: boolean };

    try {
      const service = await createService(agentId, userId, data);
      return reply.status(201).send({
        id: service.id,
        title: service.title,
        description: service.description,
        price: service.price,
        isActive: service.isActive,
      });
    } catch (error) {
      return reply.status(400).send({ error: (error as Error).message });
    }
  });

  // Update service (authenticated, owner only)
  app.put('/agents/:agentId/services/:serviceId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const { agentId, serviceId } = request.params as { agentId: string; serviceId: string };
    const data = request.body as Partial<{ title: string; description?: string; price: number; isActive: boolean }>;

    try {
      const service = await updateService(serviceId, agentId, userId, data);
      return reply.send({
        id: service.id,
        title: service.title,
        description: service.description,
        price: service.price,
        isActive: service.isActive,
      });
    } catch (error) {
      return reply.status(404).send({ error: (error as Error).message });
    }
  });

  // Delete service (authenticated, owner only)
  app.delete('/agents/:agentId/services/:serviceId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const { agentId, serviceId } = request.params as { agentId: string; serviceId: string };

    try {
      await deleteService(serviceId, agentId, userId);
      return reply.send({ success: true });
    } catch (error) {
      return reply.status(404).send({ error: (error as Error).message });
    }
  });
}
