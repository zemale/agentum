import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { getRedisClient } from '@/lib/redis.js';
import { env } from '@/config/env.js';
import { logger } from '@/lib/logger.js';

/**
 * Stored idempotency data structure
 */
interface IdempotencyData {
  method: string;
  url: string;
  body: unknown;
  statusCode: number;
  response: unknown;
  createdAt: string;
}

/**
 * Symbol to mark requests that had a cache hit (to avoid re-storing)
 */
const IDEMPOTENCY_CACHE_HIT = Symbol('idempotency-cache-hit');

/**
 * Symbol to store idempotency key for the onSend hook
 */
const IDEMPOTENCY_KEY = Symbol('idempotency-key');

/**
 * Redis key prefix for idempotency storage
 */
const IDEMPOTENCY_KEY_PREFIX = 'idempotency:';

/**
 * Default TTL for idempotency keys (24 hours in seconds)
 */
const DEFAULT_TTL = 86400;

/**
 * Header name for idempotency key
 */
const IDEMPOTENCY_HEADER = 'idempotency-key';

/**
 * Get TTL from environment or use default
 */
function getTTL(): number {
  return env.IDEMPOTENCY_TTL ?? DEFAULT_TTL;
}

/**
 * Build Redis key for idempotency storage
 */
function buildKey(idempotencyKey: string): string {
  return `${IDEMPOTENCY_KEY_PREFIX}${idempotencyKey}`;
}

/**
 * Check if request method should use idempotency
 * Only mutation methods are supported
 */
function isMutationMethod(method: string): boolean {
  const mutationMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  return mutationMethods.includes(method.toUpperCase());
}

/**
 * Get request body as a comparable object
 * Returns null if body is undefined or empty
 */
function getRequestBody(request: FastifyRequest): unknown {
  // Fastify parses body and attaches it to request.body
  return request.body ?? null;
}

/**
 * Compare two request bodies for equality
 * Handles JSON-serializable objects
 */
function bodiesMatch(body1: unknown, body2: unknown): boolean {
  return JSON.stringify(body1) === JSON.stringify(body2);
}

/**
 * Store response in Redis with idempotency key
 */
async function storeResponse(
  idempotencyKey: string,
  request: FastifyRequest,
  reply: FastifyReply,
  response: unknown
): Promise<void> {
  const redis = getRedisClient();
  const key = buildKey(idempotencyKey);
  const ttl = getTTL();

  const data: IdempotencyData = {
    method: request.method,
    url: request.url,
    body: getRequestBody(request),
    statusCode: reply.statusCode,
    response,
    createdAt: new Date().toISOString(),
  };

  await redis.setex(key, ttl, JSON.stringify(data));
}

/**
 * Get stored response from Redis
 */
async function getStoredResponse(idempotencyKey: string): Promise<IdempotencyData | null> {
  const redis = getRedisClient();
  const key = buildKey(idempotencyKey);

  const stored = await redis.get(key);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as IdempotencyData;
  } catch {
    return null;
  }
}

/**
 * Fastify plugin for idempotency support
 * 
 * - Reads Idempotency-Key header from requests
 * - Stores request/response in Redis with TTL
 * - Returns cached response for duplicate requests
 * - Returns 409 Conflict for mismatched requests (same key, different body/method)
 */
const idempotencyPlugin: FastifyPluginAsync = async (fastify) => {
  // Use preHandler hook to access parsed request body
  fastify.addHook('preHandler', async (request, reply) => {
    // Skip idempotency for non-mutation methods
    if (!isMutationMethod(request.method)) {
      return;
    }

    const idempotencyKey = request.headers[IDEMPOTENCY_HEADER];
    
    // If no idempotency key, process normally (idempotency is optional)
    if (!idempotencyKey) {
      return;
    }

    // Handle array case (header sent multiple times)
    const key = Array.isArray(idempotencyKey) ? idempotencyKey[0] : idempotencyKey;

    // Validate key format (should be a non-empty string)
    if (!key || key.trim().length === 0) {
      reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid idempotency key',
      });
      return;
    }

    // Store key on request for onSend hook
    (request as unknown as Record<symbol, string>)[IDEMPOTENCY_KEY] = key;

    const stored = await getStoredResponse(key);

    if (stored) {
      // Check for request mismatch (same key, different method/URL/body)
      const currentBody = getRequestBody(request);
      
      if (
        stored.method !== request.method ||
        stored.url !== request.url ||
        !bodiesMatch(stored.body, currentBody)
      ) {
        logger.warn({
          idempotencyKey: key,
          storedMethod: stored.method,
          storedUrl: stored.url,
          requestMethod: request.method,
          requestUrl: request.url,
        }, 'Idempotency key mismatch');

        reply.status(409).send({
          error: 'Conflict',
          message: 'Idempotency key was used for a different request',
        });
        return;
      }

      // Mark request as cache hit so onSend hook won't re-store
      (request as unknown as Record<symbol, boolean>)[IDEMPOTENCY_CACHE_HIT] = true;

      // Return cached response with original status code
      logger.info({
        idempotencyKey: key,
        method: request.method,
        url: request.url,
      }, 'Returning cached idempotency response');

      reply.status(stored.statusCode).send(stored.response);
    }
  });

  // On send: store successful responses for idempotency
  fastify.addHook('onSend', async (request, reply, payload) => {
    // Skip idempotency for non-mutation methods
    if (!isMutationMethod(request.method)) {
      return payload;
    }

    // Skip if this was a cache hit (already handled by preHandler)
    if ((request as unknown as Record<symbol, boolean>)[IDEMPOTENCY_CACHE_HIT]) {
      return payload;
    }

    const key = (request as unknown as Record<symbol, string>)[IDEMPOTENCY_KEY];
    
    // If no idempotency key was stored, don't store
    if (!key) {
      return payload;
    }

    // Double-check we don't have a stored response (to avoid race conditions)
    const stored = await getStoredResponse(key);
    if (stored) {
      return payload;
    }

    // Only store successful responses (2xx status codes)
    if (reply.statusCode >= 200 && reply.statusCode < 300) {
      try {
        const responseData = JSON.parse(payload as string);
        await storeResponse(key, request, reply, responseData);

        logger.info({
          idempotencyKey: key,
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
        }, 'Stored idempotency response');
      } catch (err) {
        // If payload is not JSON, store as-is
        await storeResponse(key, request, reply, payload);
      }
    }

    return payload;
  });
};

export default fp(idempotencyPlugin, {
  name: 'idempotency',
  dependencies: [], // No strict dependencies, but should be registered early
});

// Export for testing
export {
  buildKey,
  isMutationMethod,
  bodiesMatch,
  getRequestBody,
  IDEMPOTENCY_KEY_PREFIX,
  DEFAULT_TTL,
  IDEMPOTENCY_HEADER,
};
