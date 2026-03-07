import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  balance: z.number(),
  frozen: z.number(),
  createdAt: z.date(),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(2).optional(),
});

export type User = z.infer<typeof UserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
