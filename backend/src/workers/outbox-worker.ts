/**
 * Outbox Worker
 * 
 * Background worker that periodically processes pending outbox entries
 * and publishes them to the event bus. Implements graceful shutdown.
 */

import { processOutbox, retryFailed, getOutboxStats } from '@/services/outbox.js';
import { getEventBus } from '@/lib/event-bus.js';
import { logger } from '@/lib/logger.js';
import { outboxPending } from '@/lib/metrics.js';

// Configuration
const DEFAULT_INTERVAL_MS = 5000; // 5 seconds
const DEFAULT_BATCH_SIZE = 10;
const STATS_INTERVAL_MS = 60000; // 1 minute
const RETRY_INTERVAL_MS = 300000; // 5 minutes

interface WorkerConfig {
  intervalMs: number;
  batchSize: number;
  enableRetry: boolean;
  enableStats: boolean;
}

/**
 * Outbox Worker class
 */
export class OutboxWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private retryIntervalId: NodeJS.Timeout | null = null;
  private statsIntervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private config: WorkerConfig;

  constructor(config: Partial<WorkerConfig> = {}) {
    this.config = {
      intervalMs: DEFAULT_INTERVAL_MS,
      batchSize: DEFAULT_BATCH_SIZE,
      enableRetry: true,
      enableStats: true,
      ...config,
    };
  }

  /**
   * Initialize the event bus consumer group
   */
  async initialize(): Promise<void> {
    const eventBus = getEventBus();
    await eventBus.createConsumerGroup();
    logger.info('Outbox worker initialized');
  }

  /**
   * Process a single batch of outbox entries
   */
  private async processBatch(): Promise<void> {
    try {
      const processed = await processOutbox(this.config.batchSize);
      
      if (processed > 0) {
        logger.debug(
          { processed, batchSize: this.config.batchSize },
          'Processed outbox batch'
        );
      }
    } catch (err) {
      logger.error({ err }, 'Error processing outbox batch');
    }
  }

  /**
   * Retry failed outbox entries
   */
  private async retryFailedEntries(): Promise<void> {
    try {
      const retried = await retryFailed();
      
      if (retried > 0) {
        logger.info({ retried }, 'Retried failed outbox entries');
      }
    } catch (err) {
      logger.error({ err }, 'Error retrying failed outbox entries');
    }
  }

  /**
   * Log outbox statistics
   */
  private async logStats(): Promise<void> {
    try {
      const stats = await getOutboxStats();
      
      // Update metrics
      outboxPending.set(stats.pending);

      logger.info(
        { 
          pending: stats.pending,
          processing: stats.processing,
          completed: stats.completed,
          failed: stats.failed,
          total: stats.total 
        },
        'Outbox statistics'
      );
    } catch (err) {
      logger.error({ err }, 'Error getting outbox statistics');
    }
  }

  /**
   * Start the outbox worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Outbox worker is already running');
      return;
    }

    this.isRunning = true;

    // Initialize event bus
    await this.initialize();

    // Schedule main processing loop
    this.intervalId = setInterval(() => {
      this.processBatch();
    }, this.config.intervalMs);

    // Schedule retry loop
    if (this.config.enableRetry) {
      this.retryIntervalId = setInterval(() => {
        this.retryFailedEntries();
      }, RETRY_INTERVAL_MS);
    }

    // Schedule stats logging
    if (this.config.enableStats) {
      this.statsIntervalId = setInterval(() => {
        this.logStats();
      }, STATS_INTERVAL_MS);
    }

    // Process initial batch immediately
    await this.processBatch();

    logger.info(
      { 
        intervalMs: this.config.intervalMs,
        batchSize: this.config.batchSize,
        enableRetry: this.config.enableRetry,
        enableStats: this.config.enableStats 
      },
      'Outbox worker started'
    );
  }

  /**
   * Stop the outbox worker gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Clear intervals
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.retryIntervalId) {
      clearInterval(this.retryIntervalId);
      this.retryIntervalId = null;
    }

    if (this.statsIntervalId) {
      clearInterval(this.statsIntervalId);
      this.statsIntervalId = null;
    }

    // Process remaining pending entries before stopping
    logger.info('Processing remaining outbox entries before shutdown...');
    await this.processBatch();

    logger.info('Outbox worker stopped');
  }

  /**
   * Check if the worker is running
   */
  get running(): boolean {
    return this.isRunning;
  }
}

// Singleton instance
let workerInstance: OutboxWorker | null = null;

/**
 * Get or create the singleton outbox worker instance
 */
export function getOutboxWorker(config?: Partial<WorkerConfig>): OutboxWorker {
  if (!workerInstance) {
    workerInstance = new OutboxWorker(config);
  }
  return workerInstance;
}

/**
 * Start the outbox worker
 */
export async function startOutboxWorker(config?: Partial<WorkerConfig>): Promise<void> {
  const worker = getOutboxWorker(config);
  await worker.start();
}

/**
 * Stop the outbox worker
 */
export async function stopOutboxWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.stop();
  }
}
