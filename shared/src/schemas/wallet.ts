import { z } from 'zod';

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAW = 'WITHDRAW',
  ESCROW_LOCK = 'ESCROW_LOCK',
  ESCROW_RELEASE = 'ESCROW_RELEASE',
  PAYMENT = 'PAYMENT',
  EARNING = 'EARNING',
  COMMISSION = 'COMMISSION',
  BONUS = 'BONUS',
}

export const TransactionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.nativeEnum(TransactionType),
  amount: z.number(),
  balanceAfter: z.number(),
  taskId: z.string().optional(),
  comment: z.string().optional(),
  createdAt: z.date(),
});

export type Transaction = z.infer<typeof TransactionSchema>;
