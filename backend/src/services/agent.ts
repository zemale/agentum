import { prisma } from '../lib/prisma.js';
import { randomUUID } from 'crypto';
import type { Agent, Service, Prisma } from '@prisma/client';

export interface CreateAgentData {
  name: string;
  description?: string;
  skills: string[];
  hourlyRate: number;
}

export interface UpdateAgentData {
  name?: string;
  description?: string;
  skills?: string[];
  hourlyRate?: number;
}

export interface CreateServiceData {
  title: string;
  description?: string;
  price: number;
  isActive?: boolean;
}

export interface AgentFilters {
  skills?: string[];
  minRating?: number;
  isOnline?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export async function createAgent(ownerId: string, data: CreateAgentData): Promise<Agent> {
  const apiKey = `ak_${randomUUID().replace(/-/g, '')}`;
  
  return prisma.agent.create({
    data: {
      ...data,
      ownerId,
      apiKey,
      apiKeyRotatedAt: new Date(),
    },
  });
}

export async function getAgentById(id: string): Promise<any> {
  return prisma.agent.findFirst({
    where: { id, deletedAt: null },
    include: {
      services: {
        where: { deletedAt: null, isActive: true },
      },
      owner: {
        select: { id: true, email: true },
      },
    },
  });
}

export async function listAgents(filters: AgentFilters = {}): Promise<{ agents: Agent[]; total: number }> {
  const { skills, minRating, isOnline, search, page = 1, limit = 20 } = filters;
  
  const where: Prisma.AgentWhereInput = {
    deletedAt: null,
  };

  if (skills?.length) {
    where.skills = { hasSome: skills };
  }

  if (minRating !== undefined) {
    where.rating = { gte: minRating };
  }

  if (isOnline !== undefined) {
    where.isOnline = isOnline;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [agents, total] = await Promise.all([
    prisma.agent.findMany({
      where,
      include: {
        services: {
          where: { deletedAt: null, isActive: true },
        },
        _count: {
          select: { reviews: true },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.agent.count({ where }),
  ]);

  return { agents, total };
}

export async function updateAgent(
  id: string,
  ownerId: string,
  data: UpdateAgentData
): Promise<Agent> {
  const agent = await prisma.agent.findFirst({
    where: { id, ownerId, deletedAt: null },
  });

  if (!agent) {
    throw new Error('Agent not found or access denied');
  }

  return prisma.agent.update({
    where: { id },
    data,
  });
}

export async function deleteAgent(id: string, ownerId: string): Promise<void> {
  const agent = await prisma.agent.findFirst({
    where: { id, ownerId, deletedAt: null },
  });

  if (!agent) {
    throw new Error('Agent not found or access denied');
  }

  await prisma.agent.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function rotateApiKey(id: string, ownerId: string): Promise<string> {
  const agent = await prisma.agent.findFirst({
    where: { id, ownerId, deletedAt: null },
  });

  if (!agent) {
    throw new Error('Agent not found or access denied');
  }

  const newApiKey = `ak_${randomUUID().replace(/-/g, '')}`;

  await prisma.agent.update({
    where: { id },
    data: { apiKey: newApiKey, apiKeyRotatedAt: new Date() },
  });

  return newApiKey;
}

export async function updateIpWhitelist(id: string, ownerId: string, ips: string[]): Promise<Agent> {
  const agent = await prisma.agent.findFirst({
    where: { id, ownerId, deletedAt: null },
  });

  if (!agent) {
    throw new Error('Agent not found or access denied');
  }

  return prisma.agent.update({
    where: { id },
    data: { ipWhitelist: ips },
  });
}

export async function verifyApiKey(apiKey: string): Promise<Agent | null> {
  return prisma.agent.findFirst({
    where: { apiKey, deletedAt: null },
  });
}

export async function updateOnlineStatus(id: string, isOnline: boolean): Promise<void> {
  await prisma.agent.update({
    where: { id },
    data: { 
      isOnline, 
      lastPollAt: isOnline ? new Date() : undefined 
    },
  });
}

export async function getAgentByOwner(ownerId: string): Promise<Agent | null> {
  return prisma.agent.findFirst({
    where: { ownerId, deletedAt: null },
  });
}

export async function getMyAgents(ownerId: string): Promise<Agent[]> {
  return prisma.agent.findMany({
    where: { ownerId, deletedAt: null },
    include: {
      services: {
        where: { deletedAt: null },
      },
      _count: {
        select: { tasks: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// Service functions
export async function createService(agentId: string, ownerId: string, data: CreateServiceData): Promise<Service> {
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, ownerId, deletedAt: null },
  });

  if (!agent) {
    throw new Error('Agent not found or access denied');
  }

  return prisma.service.create({
    data: {
      ...data,
      agentId,
    },
  });
}

export async function getAgentServices(agentId: string): Promise<Service[]> {
  return prisma.service.findMany({
    where: { agentId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateService(
  serviceId: string,
  agentId: string,
  ownerId: string,
  data: Partial<CreateServiceData>
): Promise<Service> {
  const service = await prisma.service.findFirst({
    where: { 
      id: serviceId, 
      agentId,
      agent: { ownerId },
      deletedAt: null 
    },
  });

  if (!service) {
    throw new Error('Service not found or access denied');
  }

  return prisma.service.update({
    where: { id: serviceId },
    data,
  });
}

export async function deleteService(serviceId: string, agentId: string, ownerId: string): Promise<void> {
  const service = await prisma.service.findFirst({
    where: { 
      id: serviceId, 
      agentId,
      agent: { ownerId },
      deletedAt: null 
    },
  });

  if (!service) {
    throw new Error('Service not found or access denied');
  }

  await prisma.service.update({
    where: { id: serviceId },
    data: { deletedAt: new Date() },
  });
}
