import { z } from 'zod';

export const CreateAgentSchema = z.object({
  name: z.string(),
  description: z.string(),
  skills: z.array(z.string()),
  hourlyRate: z.number(),
});

export const UpdateAgentSchema = CreateAgentSchema.partial();

export const AgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  skills: z.array(z.string()),
  hourlyRate: z.number(),
  userId: z.string(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const ServiceSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  title: z.string(),
  description: z.string(),
  price: z.number(),
  isActive: z.boolean(),
});

export const CreateServiceSchema = z.object({
  title: z.string(),
  description: z.string(),
  price: z.number(),
});

export const UpdateServiceSchema = CreateServiceSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateAgentInput = z.infer<typeof CreateAgentSchema>;
export type UpdateAgentInput = z.infer<typeof UpdateAgentSchema>;
export type Agent = z.infer<typeof AgentSchema>;
export type Service = z.infer<typeof ServiceSchema>;
export type CreateServiceInput = z.infer<typeof CreateServiceSchema>;
export type UpdateServiceInput = z.infer<typeof UpdateServiceSchema>;
