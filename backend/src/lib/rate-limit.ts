import type { FastifyRequest, FastifyReply } from 'fastify';
import type { errorResponseBuilderContext } from '@fastify/rate-limit';
import { logger } from './logger.js';

/**
 * Custom key generator for rate limiting
 * - Uses userId for authenticated users
 * - Uses IP address for anonymous users
 */
export function generateRateLimitKey(request: FastifyRequest): string {
  // Check if user is authenticated (JWT token present and valid)
  const userId = request.user?.id;
  
  if (userId) {
    return `user:${userId}`;
  }
  
  // Fall back to IP address for anonymous users
  const ip = request.ip;
  return `ip:${ip}`;
}

/**
 * Key generator specifically for API key based rate limiting
 * Uses the API key as the identifier
 */
export function generateApiKeyRateLimitKey(request: FastifyRequest): string {
  // Get API key from header
  const apiKey = request.headers['x-api-key'];
  
  if (apiKey && typeof apiKey === 'string') {
    return `apikey:${apiKey}`;
  }
  
  // Fall back to IP if no API key
  return `ip:${request.ip}`;
}

/**
 * Key generator for strict rate limiting (auth endpoints)
 * Always uses IP address to prevent brute force attacks on auth endpoints
 */
export function generateStrictRateLimitKey(request: FastifyRequest): string {
  // For auth endpoints, always use IP to prevent brute force
  // even if a token is somehow present but invalid
  return `auth:${request.ip}`;
}

/**
 * Custom error handler for rate limit exceeded
 * Returns an object that will be sent as the error response
 */
export function rateLimitErrorHandler(
  request: FastifyRequest,
  context: errorResponseBuilderContext
): object {
  const retryAfterSeconds = Math.ceil(context.ttl / 1000);
  
  logger.warn({
    ip: request.ip,
    url: request.url,
    method: request.method,
    userAgent: request.headers['user-agent'],
    retryAfter: retryAfterSeconds,
  }, 'Rate limit exceeded');

  return {
    statusCode: 429,
    error: 'Too Many Requests',
    message: `Rate limit exceeded. Try again in ${retryAfterSeconds} seconds.`,
    retryAfter: retryAfterSeconds,
  };
}

/**
 * Skip logic for health check endpoints
 * Health check endpoints are not counted towards rate limit
 */
export function shouldSkipRateLimit(request: FastifyRequest): boolean {
  // Skip health check endpoints entirely from rate limiting
  if (request.url === '/health' || request.url === '/health/redis') {
    return true;
  }
  
  return false;
}

