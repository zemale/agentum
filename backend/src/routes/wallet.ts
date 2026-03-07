import type { FastifyInstance } from 'fastify';
import type { TransactionType } from '@prisma/client';
import {
  getWalletStats,
  getTransactionHistory,
  type TransactionFilters,
  type TransactionPagination,
} from '../services/wallet.js';

const VALID_TRANSACTION_TYPES: TransactionType[] = [
  'DEPOSIT',
  'WITHDRAWAL',
  'TASK_PAYMENT',
  'TASK_REFUND',
  'TASK_REWARD',
  'FEE',
  'ADJUSTMENT',
];

export default async function walletRoutes(app: FastifyInstance) {
  // Get wallet stats (authenticated)
  app.get(
    '/stats',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;

      try {
        const stats = await getWalletStats(userId);
        return reply.send(stats);
      } catch (error) {
        const message = (error as Error).message;
        return reply.status(404).send({ error: message });
      }
    }
  );

  // Get transaction history (authenticated)
  app.get(
    '/transactions',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const query = request.query as Record<string, string>;

      // Parse pagination params
      const limit = query.limit ? parseInt(query.limit, 10) : 20;
      const lastId = query.lastId;

      // Validate limit
      const validatedLimit = Math.min(Math.max(limit, 1), 100);

      // Parse filters
      const filters: TransactionFilters = {};

      // Validate and parse type filter
      if (query.type) {
        if (VALID_TRANSACTION_TYPES.includes(query.type as TransactionType)) {
          filters.type = query.type as TransactionType;
        } else {
          return reply.status(400).send({
            error: 'Invalid transaction type',
            validTypes: VALID_TRANSACTION_TYPES,
          });
        }
      }

      // Parse date filters
      if (query.dateFrom) {
        const dateFrom = new Date(query.dateFrom);
        if (isNaN(dateFrom.getTime())) {
          return reply.status(400).send({
            error: 'Invalid dateFrom format',
          });
        }
        filters.dateFrom = dateFrom;
      }

      if (query.dateTo) {
        const dateTo = new Date(query.dateTo);
        if (isNaN(dateTo.getTime())) {
          return reply.status(400).send({
            error: 'Invalid dateTo format',
          });
        }
        filters.dateTo = dateTo;
      }

      // Validate date range
      if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
        return reply.status(400).send({
          error: 'dateFrom must be before dateTo',
        });
      }

      const pagination: TransactionPagination = {
        limit: validatedLimit,
        ...(lastId && { lastId }),
      };

      try {
        const result = await getTransactionHistory(userId, filters, pagination);

        return reply.send({
          transactions: result.transactions.map((t) => ({
            id: t.id,
            type: t.type,
            amount: t.amount,
            balanceAfter: t.balanceAfter,
            taskId: t.taskId,
            metadata: t.metadata,
            comment: t.comment,
            createdAt: t.createdAt,
          })),
          nextCursor: result.nextCursor,
        });
      } catch (error) {
        const message = (error as Error).message;
        return reply.status(500).send({ error: message });
      }
    }
  );
}
