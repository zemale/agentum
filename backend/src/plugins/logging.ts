import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { env } from '@/config/env.js';
import { generateTraceId, createChildLogger, logger } from '@/lib/logger.js';

/**
 * Extract trace ID from request headers or generate a new one
 * Checks for X-Trace-ID header first, generates if not present
 */
function getTraceId(request: FastifyRequest): string {
  // Check for X-Trace-ID header (case-insensitive)
  const headerTraceId = request.headers['x-trace-id'];
  if (headerTraceId) {
    return Array.isArray(headerTraceId) ? headerTraceId[0] : headerTraceId;
  }
  // Generate new trace ID if not provided
  return generateTraceId();
}

/**
 * Fastify plugin for structured request logging with trace_id support
 */
const loggingPlugin: FastifyPluginAsync = async (fastify) => {
  // On request: extract/generate trace_id and store context
  fastify.addHook('onRequest', async (request) => {
    const traceId = getTraceId(request);
    // Store trace_id on request object for access in routes
    (request as FastifyRequest & { trace_id: string }).trace_id = traceId;

    // Create a child logger with trace_id for this request
    const requestLogger = createChildLogger(traceId);

    // Attach logger to request for use in route handlers
    request.log = requestLogger;
  });

  // On response: log request completion with timing
  fastify.addHook('onResponse', async (request, reply) => {
    const traceId = (request as FastifyRequest & { trace_id: string }).trace_id;

    const logData = {
      trace_id: traceId,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      duration: reply.elapsedTime,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    };

    // Log at appropriate level based on status code
    if (reply.statusCode >= 500) {
      logger.error(logData, 'Request completed with server error');
    } else if (reply.statusCode >= 400) {
      logger.warn(logData, 'Request completed with client error');
    } else {
      logger.info(logData, 'Request completed successfully');
    }
  });

  // On error: log errors with full context
  // Note: onError fires before onResponse, so the error will be logged first
  fastify.addHook('onError', async (request, reply, error) => {
    const traceId = (request as FastifyRequest & { trace_id: string }).trace_id;

    // Use the actual status code that will be sent (Fastify sets this on error)
    const statusCode = reply.statusCode >= 400 ? reply.statusCode : 500;

    logger.error(
      {
        trace_id: traceId,
        method: request.method,
        url: request.url,
        statusCode,
        error: {
          message: error.message,
          code: error.code,
          stack: env.NODE_ENV === 'development' ? error.stack : undefined,
        },
        userAgent: request.headers['user-agent'],
        ip: request.ip,
      },
      'Request failed with error'
    );
  });
};

export default fp(loggingPlugin, {
  name: 'logging',
});
