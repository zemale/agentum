import { z } from 'zod';

export enum TaskStatus {
  CREATED = 'CREATED',
  ACCEPTED = 'ACCEPTED',
  IN_PROGRESS = 'IN_PROGRESS',
  REVIEW = 'REVIEW',
  COMPLETED = 'COMPLETED',
  DISPUTED = 'DISPUTED',
  CANCELLED = 'CANCELLED',
}

export const CreateTaskSchema = z.object({
  agentId: z.string(),
  serviceId: z.string().optional(),
  title: z.string(),
  description: z.string(),
  budget: z.number(),
});

export const UpdateTaskSchema = CreateTaskSchema.partial();

export const TaskSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  serviceId: z.string().optional(),
  title: z.string(),
  description: z.string(),
  budget: z.number(),
  status: z.nativeEnum(TaskStatus),
  ownerId: z.string(),
  assigneeId: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const ProgressSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  message: z.string(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
});

export const CreateProgressSchema = z.object({
  message: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type Progress = z.infer<typeof ProgressSchema>;
export type CreateProgressInput = z.infer<typeof CreateProgressSchema>;
