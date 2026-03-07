/**
 * Wallet Handler
 * 
 * Handles financial events related to wallet operations:
 * - Escrow locking
 * - Escrow release
 * - Payment processing
 */

import { prisma } from '@/lib/prisma.js';
import { logger } from '@/lib/logger.js';
import { walletBalanceTotal } from '@/lib/metrics.js';
import { 
  type DomainEvent, 
  EventTypes, 
  type EscrowLockPayload,
  type EscrowReleasePayload,
  type PaymentPayload,
} from '@/lib/events.js';
import { type EventHandler } from './registry.js';
import { TransactionType } from '@prisma/client';

/**
 * Wallet Handler class
 * Handles wallet-related domain events
 */
export class WalletHandler implements EventHandler {
  /**
   * Handle a domain event related to wallet operations
   */
  async handle(event: DomainEvent): Promise<void> {
    switch (event.type) {
      case EventTypes.ESCROW_LOCK:
        await this.handleEscrowLock(event.payload as EscrowLockPayload);
        break;

      case EventTypes.ESCROW_RELEASE:
        await this.handleEscrowRelease(event.payload as EscrowReleasePayload);
        break;

      case EventTypes.PAYMENT:
        await this.handlePayment(event.payload as PaymentPayload);
        break;

      default:
        // Not a wallet-related event
        break;
    }
  }

  /**
   * Handle escrow lock event
   * Locks funds in the user's wallet
   */
  private async handleEscrowLock(payload: EscrowLockPayload): Promise<void> {
    try {
      // Get user's current balance
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user) {
        throw new Error(`User not found: ${payload.userId}`);
      }

      if (user.balance < payload.amount) {
        throw new Error(
          `Insufficient balance for user ${payload.userId}: ` +
          `required ${payload.amount}, available ${user.balance}`
        );
      }

      // Update user's balance and frozen amount
      await prisma.user.update({
        where: { id: payload.userId },
        data: {
          balance: { decrement: payload.amount },
          frozen: { increment: payload.amount },
        },
      });

      // Create transaction record
      await prisma.transaction.create({
        data: {
          userId: payload.userId,
          type: TransactionType.TASK_PAYMENT,
          amount: -payload.amount,
          balanceAfter: user.balance - payload.amount,
          taskId: payload.taskId,
          metadata: {
            escrowLock: true,
            transactionId: payload.transactionId,
          },
          comment: `Escrow lock for task ${payload.taskId}`,
        },
      });

      // Update wallet metrics
      await this.updateWalletMetrics();

      logger.info(
        {
          userId: payload.userId,
          taskId: payload.taskId,
          amount: payload.amount,
          transactionId: payload.transactionId,
        },
        'Escrow funds locked'
      );
    } catch (err) {
      logger.error(
        { err, payload },
        'Failed to lock escrow funds'
      );
      throw err;
    }
  }

  /**
   * Handle escrow release event
   * Releases funds from escrow to the recipient
   */
  private async handleEscrowRelease(payload: EscrowReleasePayload): Promise<void> {
    try {
      // Get sender's current state
      const fromUser = await prisma.user.findUnique({
        where: { id: payload.fromUserId },
      });

      if (!fromUser) {
        throw new Error(`Sender not found: ${payload.fromUserId}`);
      }

      if (fromUser.frozen < payload.amount) {
        throw new Error(
          `Insufficient frozen balance for user ${payload.fromUserId}: ` +
          `required ${payload.amount}, frozen ${fromUser.frozen}`
        );
      }

      // Get recipient's current state
      const toUser = await prisma.user.findUnique({
        where: { id: payload.toUserId },
      });

      if (!toUser) {
        throw new Error(`Recipient not found: ${payload.toUserId}`);
      }

      // Perform the transfer in a transaction
      await prisma.$transaction([
        // Decrement sender's frozen amount
        prisma.user.update({
          where: { id: payload.fromUserId },
          data: {
            frozen: { decrement: payload.amount },
          },
        }),

        // Increment recipient's balance
        prisma.user.update({
          where: { id: payload.toUserId },
          data: {
            balance: { increment: payload.amount },
          },
        }),

        // Create sender's transaction record (escrow release)
        prisma.transaction.create({
          data: {
            userId: payload.fromUserId,
            type: TransactionType.TASK_PAYMENT,
            amount: 0, // No balance change, just frozen reduction
            balanceAfter: fromUser.balance,
            taskId: payload.taskId,
            metadata: {
              escrowRelease: true,
              toUserId: payload.toUserId,
              amount: payload.amount,
              transactionId: payload.transactionId,
            },
            comment: `Escrow release for task ${payload.taskId}`,
          },
        }),

        // Create recipient's transaction record (reward)
        prisma.transaction.create({
          data: {
            userId: payload.toUserId,
            type: TransactionType.TASK_REWARD,
            amount: payload.amount,
            balanceAfter: toUser.balance + payload.amount,
            taskId: payload.taskId,
            metadata: {
              fromUserId: payload.fromUserId,
              transactionId: payload.transactionId,
            },
            comment: `Task reward for ${payload.taskId}`,
          },
        }),
      ]);

      // Update wallet metrics
      await this.updateWalletMetrics();

      logger.info(
        {
          fromUserId: payload.fromUserId,
          toUserId: payload.toUserId,
          taskId: payload.taskId,
          amount: payload.amount,
          transactionId: payload.transactionId,
        },
        'Escrow funds released'
      );
    } catch (err) {
      logger.error(
        { err, payload },
        'Failed to release escrow funds'
      );
      throw err;
    }
  }

  /**
   * Handle payment event
   * Processes various types of payments
   */
  private async handlePayment(payload: PaymentPayload): Promise<void> {
    try {
      const recipient = await prisma.user.findUnique({
        where: { id: payload.toUserId },
      });

      if (!recipient) {
        throw new Error(`Recipient not found: ${payload.toUserId}`);
      }

      let transactionType: TransactionType;
      let comment: string;

      switch (payload.type) {
        case 'DEPOSIT':
          transactionType = TransactionType.DEPOSIT;
          comment = 'Deposit';
          break;
        case 'WITHDRAWAL':
          transactionType = TransactionType.WITHDRAWAL;
          comment = 'Withdrawal';
          break;
        case 'TASK_PAYMENT':
          transactionType = TransactionType.TASK_PAYMENT;
          comment = `Task payment for ${payload.taskId}`;
          break;
        case 'TASK_REWARD':
          transactionType = TransactionType.TASK_REWARD;
          comment = `Task reward for ${payload.taskId}`;
          break;
        case 'REFUND':
          transactionType = TransactionType.TASK_REFUND;
          comment = `Refund for task ${payload.taskId}`;
          break;
        default:
          transactionType = TransactionType.ADJUSTMENT;
          comment = 'Payment adjustment';
      }

      // Create transaction record for recipient
      await prisma.transaction.create({
        data: {
          userId: payload.toUserId,
          type: transactionType,
          amount: payload.amount,
          balanceAfter: recipient.balance + payload.amount,
          taskId: payload.taskId,
          metadata: {
            paymentId: payload.paymentId,
            fromUserId: payload.fromUserId,
          },
          comment,
        },
      });

      // Update recipient's balance
      await prisma.user.update({
        where: { id: payload.toUserId },
        data: {
          balance: { increment: payload.amount },
        },
      });

      // If there's a sender, create their transaction record too
      if (payload.fromUserId) {
        const sender = await prisma.user.findUnique({
          where: { id: payload.fromUserId },
        });

        if (sender) {
          await prisma.transaction.create({
            data: {
              userId: payload.fromUserId,
              type: transactionType,
              amount: -payload.amount,
              balanceAfter: sender.balance - payload.amount,
              taskId: payload.taskId,
              metadata: {
                paymentId: payload.paymentId,
                toUserId: payload.toUserId,
              },
              comment,
            },
          });

          // Update sender's balance
          await prisma.user.update({
            where: { id: payload.fromUserId },
            data: {
              balance: { decrement: payload.amount },
            },
          });
        }
      }

      // Update wallet metrics
      await this.updateWalletMetrics();

      logger.info(
        {
          paymentId: payload.paymentId,
          fromUserId: payload.fromUserId,
          toUserId: payload.toUserId,
          amount: payload.amount,
          type: payload.type,
        },
        'Payment processed'
      );
    } catch (err) {
      logger.error(
        { err, payload },
        'Failed to process payment'
      );
      throw err;
    }
  }

  /**
   * Update wallet metrics
   */
  private async updateWalletMetrics(): Promise<void> {
    try {
      const result = await prisma.user.aggregate({
        _sum: {
          balance: true,
        },
      });

      const totalBalance = result._sum.balance || 0;
      walletBalanceTotal.set(totalBalance);
    } catch (err) {
      logger.error({ err }, 'Failed to update wallet metrics');
    }
  }
}

/**
 * Get wallet statistics
 */
export async function getWalletStats(): Promise<{
  totalBalance: number;
  totalFrozen: number;
  userCount: number;
}> {
  const result = await prisma.user.aggregate({
    _sum: {
      balance: true,
      frozen: true,
    },
    _count: {
      id: true,
    },
  });

  return {
    totalBalance: result._sum.balance || 0,
    totalFrozen: result._sum.frozen || 0,
    userCount: result._count.id,
  };
}

/**
 * Get user wallet summary
 */
export async function getUserWalletSummary(userId: string): Promise<{
  balance: number;
  frozen: number;
  totalTransactions: number;
} | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: {
          transactions: true,
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  return {
    balance: user.balance,
    frozen: user.frozen,
    totalTransactions: user._count.transactions,
  };
}
