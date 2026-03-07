import { z } from 'zod';

export const IdSchema = z.string().cuid();

export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  cursor: z.string().optional(),
});

export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
});

export const IdempotencyKeySchema = z.object({
  'idempotency-key': z.string(),
});

export type Id = z.infer<typeof IdSchema>;
export type PaginationInput = z.infer<typeof PaginationSchema>;
export type ApiResponse = z.infer<typeof ApiResponseSchema>;
export type IdempotencyKeyInput = z.infer<typeof IdempotencyKeySchema>;
