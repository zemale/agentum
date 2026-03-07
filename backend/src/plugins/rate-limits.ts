import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyInstance, FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import type { 
  FastifyRateLimitOptions, 
  RateLimitPluginOptions,
  errorResponseBuilderContext 
} from '@fastify/rate-limit';
import { getRedisClient } from '@/lib/redis.js';
import { env } from '@/config/env.js';
import {
  generateRateLimitKey,
  generateApiKeyRateLimitKey,
  generateStrictRateLimitKey,
  rateLimitErrorHandler,
  shouldSkipRateLimit,
} from '@/lib/rate-limit.js';
import { logger } from '@/lib/logger.js';

/**
 * Rate limit configurations for different use cases
 */
export const rateLimitConfigs = {
  /**
   * Anonymous users: 30 requests per minute per IP
   */
  anonymous: {
    max: 30,
    timeWindow: '1 minute',
    keyGenerator: generateRateLimitKey,
    errorResponseBuilder: rateLimitErrorHandler,
    onExceeded: async (request: FastifyRequest, key: string) => {
      logger.warn({
        ip: request.ip,
        url: request.url,
        key,
        type: 'anonymous',
      }, 'Anonymous rate limit exceeded');
    },
  } as RateLimitPluginOptions,

  /**
   * Authenticated users: 100 requests per minute per user
   */
  authenticated: {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: generateRateLimitKey,
    errorResponseBuilder: rateLimitErrorHandler,
    onExceeded: async (request: FastifyRequest, key: string) => {
      logger.warn({
        ip: request.ip,
        url: request.url,
        userId: request.user?.id,
        key,
        type: 'authenticated',
      }, 'Authenticated rate limit exceeded');
    },
  } as RateLimitPluginOptions,

  /**
   * Agent API: 100 requests per minute per API key
   */
  agentApi: {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: generateApiKeyRateLimitKey,
    errorResponseBuilder: rateLimitErrorHandler,
    onExceeded: async (request: FastifyRequest, key: string) => {
      logger.warn({
        ip: request.ip,
        url: request.url,
        apiKey: request.headers['x-api-key'],
        key,
        type: 'agent_api',
      }, 'Agent API rate limit exceeded');
    },
  } as RateLimitPluginOptions,

  /**
   * Strict rate limiting: 10 requests per minute (for auth endpoints)
   */
  strict: {
    max: 10,
    timeWindow: '1 minute',
    keyGenerator: generateStrictRateLimitKey,
    errorResponseBuilder: rateLimitErrorHandler,
    onExceeded: async (request: FastifyRequest, key: string) => {
      logger.warn({
        ip: request.ip,
        url: request.url,
        key,
        type: 'strict',
      }, 'Strict rate limit exceeded (auth endpoint)');
    },
  } as RateLimitPluginOptions,

  /**
   * Custom rate limit configuration factory
   */
  custom: (max: number, timeWindow: string, keyGen?: (req: FastifyRequest) => string | number | Promise<string | number>): RateLimitPluginOptions => ({
    max,
    timeWindow,
    keyGenerator: keyGen || generateRateLimitKey,
    errorResponseBuilder: rateLimitErrorHandler,
  }),
};

/**
 * Helper function to apply rate limit to specific routes
 * Usage in route definition:
 * 
 * ```typescript
 * app.get('/route', {
 *   preHandler: [app.rateLimit({ max: 10, timeWindow: '1 minute' })]
 * }, handler);
 * ```
 */
export function applyRateLimit(config: RateLimitPluginOptions) {
  // Return a preHandler function that applies rate limiting
  return async function rateLimitPreHandler(
    this: FastifyInstance,
    request: FastifyRequest,
    reply: Parameters<(request: FastifyRequest, context: errorResponseBuilderContext) => object>[1]
  ): Promise<void> {
    // Skip if rate limiting is disabled
    if (env.RATE_LIMIT_ENABLED === false) {
      return;
    }

    // Skip health check endpoints
    if (shouldSkipRateLimit(request)) {
      return;
    }

    // Rate limiting logic is handled by the plugin
    // This is just a placeholder for manual application if needed
  };
}

/**
 * Allow list function to skip rate limiting for health checks
 */
async function allowList(req: FastifyRequest): Promise<boolean> {
  // Skip health check endpoints from rate limiting
  if (req.url === '/health' || req.url === '/health/redis' || req.url.startsWith('/health/')) {
    return true;
  }
  return false;
}

/**
 * Fastify plugin for rate limiting with Redis store
 */
const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  // Skip if rate limiting is disabled
  if (env.RATE_LIMIT_ENABLED === false) {
    logger.info('Rate limiting is disabled');
    return;
  }

  try {
    // Get Redis client for distributed rate limiting
    const redisClient = getRedisClient();
    
    // Check if Redis client is properly connected (for production use)
    // In tests, we may have a mock client, so we check for defineCommand support
    const isRedisAvailable = redisClient && typeof redisClient.defineCommand === 'function';

    // Register rate limit plugin with or without Redis store
    await fastify.register(rateLimit, {
      max: 100, // Default global limit: 100 requests per minute
      timeWindow: '1 minute',
      ...(isRedisAvailable ? { redis: redisClient } : {}),
      keyGenerator: generateRateLimitKey,
      errorResponseBuilder: rateLimitErrorHandler,
      skipOnError: true, // Don't fail requests if Redis is down
      allowList, // Skip rate limiting for health checks
      onExceeded: async (request: FastifyRequest, key: string) => {
        logger.warn({
          ip: request.ip,
          url: request.url,
          userId: request.user?.id,
          key,
        }, 'Global rate limit exceeded');
      },
    } as FastifyRateLimitOptions);

    logger.info(`Rate limiting plugin registered${isRedisAvailable ? ' with Redis store' : ' with in-memory store'}`);
  } catch (error) {
    logger.error({ error }, 'Failed to register rate limiting plugin');
    // Don't fail server startup if rate limiting setup fails
    // The skipOnError option handles Redis failures at runtime
  }
};

export default fp(rateLimitPlugin, {
  name: 'rate-limits',
  dependencies: [],
});

// Re-export configs for use in routes
export { generateRateLimitKey, generateApiKeyRateLimitKey, generateStrictRateLimitKey };
