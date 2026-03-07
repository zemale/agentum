import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import * as Sentry from '@sentry/node';
import { env } from '@/config/env.js';

/**
 * Check if error is a client error (4xx)
 */
function isClientError(statusCode: number): boolean {
  return statusCode >= 400 && statusCode < 500;
}

/**
 * Check if error is a server error (5xx)
 */
function isServerError(statusCode: number): boolean {
  return statusCode >= 500;
}

/**
 * Extract user info from request if available
 */
function getUserFromRequest(request: FastifyRequest): { id: string; email?: string } | null {
  // Check for JWT user (from @fastify/jwt)
  const user = (request as FastifyRequest & { user?: { id: string; email?: string } }).user;
  if (user?.id) {
    return {
      id: user.id,
      email: user.email,
    };
  }
  return null;
}

/**
 * Sanitize headers for Sentry context (remove sensitive data)
 */
function sanitizeHeaders(headers: FastifyRequest['headers']): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    // Skip sensitive headers
    if (
      lowerKey === 'authorization' ||
      lowerKey === 'cookie' ||
      lowerKey === 'x-api-key' ||
      lowerKey === 'api-key' ||
      lowerKey === 'x-auth-token'
    ) {
      sanitized[key] = '[REDACTED]';
    } else if (value !== undefined) {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Sanitize request body for Sentry context (remove sensitive data)
 */
function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'apiKey',
    'api_key',
    'accessToken',
    'access_token',
    'refreshToken',
    'refresh_token',
    'creditCard',
    'credit_card',
    'cvv',
    'ssn',
    'passwordHash',
    'password_hash',
  ];

  const sanitized = { ...body as Record<string, unknown> };
  
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

/**
 * Build sanitized error response
 * - In development: include error details
 * - In production: hide internal error details
 */
function buildErrorResponse(error: Error, statusCode: number): Record<string, unknown> {
  const isDev = env.NODE_ENV === 'development';
  
  // Base response
  const response: Record<string, unknown> = {
    error: true,
    message: isClientError(statusCode) ? error.message : 'Internal Server Error',
    statusCode,
  };

  // Include additional details in development
  if (isDev) {
    response.message = error.message;
    response.code = (error as Error & { code?: string }).code;
    response.stack = error.stack;
  }

  return response;
}

/**
 * Fastify error handler plugin with Sentry integration
 */
const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  // Set up the error handler
  fastify.setErrorHandler(async (error, request, reply) => {
    const statusCode = error.statusCode || 500;
    const isServerErr = isServerError(statusCode);
    
    // Only capture server errors (5xx) or unexpected errors with Sentry
    // Client errors (4xx) are usually expected and don't need to be tracked
    if (isServerErr || !error.statusCode) {
      Sentry.withScope((scope) => {
        // Add request context
        scope.setContext('request', {
          url: request.url,
          method: request.method,
          headers: sanitizeHeaders(request.headers),
          body: sanitizeBody(request.body),
          query: request.query,
          params: request.params,
          ip: request.ip,
          trace_id: request.trace_id,
        });

        // Add user context if available
        const user = getUserFromRequest(request);
        if (user) {
          scope.setUser(user);
        }

        // Add tags
        scope.setTag('url', request.url);
        scope.setTag('method', request.method);
        scope.setTag('status_code', String(statusCode));

        // Capture the exception
        Sentry.captureException(error);
      });
    }

    // Log the error
    request.log.error({
      error: {
        message: error.message,
        code: (error as Error & { code?: string }).code,
        stack: env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      statusCode,
      trace_id: request.trace_id,
    }, 'Error handling request');

    // Send response
    const response = buildErrorResponse(error, statusCode);
    return reply.status(statusCode).send(response);
  });

  // Handle 404 errors
  fastify.setNotFoundHandler(async (request, reply) => {
    const statusCode = 404;
    
    // Optionally track 404s in Sentry (disabled by default as they're usually noise)
    // Uncomment if you want to track 404 errors
    // Sentry.withScope((scope) => {
    //   scope.setContext('request', {
    //     url: request.url,
    //     method: request.method,
    //     headers: sanitizeHeaders(request.headers),
    //   });
    //   scope.setTag('url', request.url);
    //   scope.setTag('method', request.method);
    //   Sentry.captureMessage(`Not Found: ${request.method} ${request.url}`, 'warning');
    // });

    request.log.warn({
      url: request.url,
      method: request.method,
      trace_id: request.trace_id,
    }, 'Route not found');

    const response = buildErrorResponse(
      new Error(`Route ${request.method} ${request.url} not found`),
      statusCode
    );
    
    return reply.status(statusCode).send(response);
  });
};

export default fp(errorHandlerPlugin, {
  name: 'error-handler',
});
