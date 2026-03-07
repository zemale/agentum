import pino from 'pino';
import { env } from '@/config/env.js';

/**
 * Service metadata for structured logging
 */
const SERVICE_INFO = {
  service: 'agentum-api',
  version: '1.0.0',
};

/**
 * Generate a unique trace ID for request tracing
 */
export function generateTraceId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Create the base Pino logger instance
 * - Pretty print in development
 * - JSON in production
 */
function createLogger() {
  const isDev = env.NODE_ENV === 'development';

  const options: pino.LoggerOptions = {
    level: env.LOG_LEVEL,
    base: {
      pid: process.pid,
      ...SERVICE_INFO,
    },
  };

  // Use pretty print in development for human-readable logs
  const destination = isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
          messageFormat: '{msg} [trace_id={trace_id}]',
        },
      }
    : undefined;

  if (destination) {
    return pino(options, pino.transport(destination));
  }

  return pino(options);
}

/**
 * Global logger instance
 */
export const logger = createLogger();

/**
 * Create a child logger with trace_id for request context
 */
export function createChildLogger(traceId: string, extraBindings: Record<string, unknown> = {}) {
  return logger.child({
    trace_id: traceId,
    ...extraBindings,
  });
}

/**
 * Log level type
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export default logger;
