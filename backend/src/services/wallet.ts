import { prisma } from '../lib/prisma.js';
import type { Transaction, TransactionType } from '@prisma/client';
import { Prisma } from '@prisma/client';

export interface WalletStats {
  balance: number;
  frozen: number;
  total: number;
}

export interface TransactionFilters {
  type?: TransactionType;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface TransactionPagination {
  lastId?: string;
  limit: number;
}

export interface TransactionHistoryResult {
  transactions: Transaction[];
  nextCursor: string | null;
}

export interface CreateTransactionData {
  userId: string;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  taskId?: string;
  metadata?: Record<string, unknown>;
  comment?: string;
}

/**
 * Get wallet statistics for a user (balance, frozen, total)
 */
export async function getWalletStats(userId: string): Promise<WalletStats> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { balance: true, frozen: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  return {
    balance: user.balance,
    frozen: user.frozen,
    total: user.balance + user.frozen,
  };
}

/**
 * Get transaction history with cursor-based pagination and filters
 */
export async function getTransactionHistory(
  userId: string,
  filters: TransactionFilters = {},
  pagination: TransactionPagination = { limit: 20 }
): Promise<TransactionHistoryResult> {
  const { type, dateFrom, dateTo } = filters;
  const { lastId, limit } = pagination;

  // Build where clause
  const where: Prisma.TransactionWhereInput = {
    userId,
  };

  // Apply cursor-based pagination filter
  if (lastId) {
    where.id = { lt: lastId };
  }

  // Apply type filter
  if (type) {
    where.type = type;
  }

  // Apply date range filter
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) {
      where.createdAt.gte = dateFrom;
    }
    if (dateTo) {
      where.createdAt.lte = dateTo;
    }
  }

  // Fetch one extra record to determine if there are more results
  const transactions = await prisma.transaction.findMany({
    where,
    take: limit + 1,
    orderBy: { createdAt: 'desc' },
  });

  // Check if there are more results
  const hasMore = transactions.length > limit;
  
  // Remove the extra record used for checking hasMore
  const results = hasMore ? transactions.slice(0, limit) : transactions;
  
  // Generate next cursor from the last record (if we have more results)
  const nextCursor = hasMore && results.length > 0 ? results[results.length - 1].id : null;

  return {
    transactions: results,
    nextCursor,
  };
}

/**
 * Create a new transaction record
 */
export async function createTransaction(data: CreateTransactionData): Promise<Transaction> {
  return prisma.transaction.create({
    data: {
      userId: data.userId,
      type: data.type,
      amount: data.amount,
      balanceAfter: data.balanceAfter,
      taskId: data.taskId,
      metadata: data.metadata ?? Prisma.JsonNull,
      comment: data.comment,
    },
  });
}

/**
 * Get a single transaction by ID for a specific user
 */
export async function getTransactionById(
  transactionId: string,
  userId: string
): Promise<Transaction | null> {
  return prisma.transaction.findFirst({
    where: {
      id: transactionId,
      userId,
    },
  });
}
