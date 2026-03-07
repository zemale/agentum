import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { verifyApiKey } from '../services/agent.js';
import { getRedisClient } from '../lib/redis.js';

// Extend Fastify types
declare module 'fastify' {
  interface FastifyRequest {
    agent?: {
      id: string;
      ownerId: string;
      name: string;
    };
  }

  interface FastifyInstance {
    authenticateAgent: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

// Rate limiting for agent API
async function checkAgentRateLimit(apiKey: string): Promise<boolean> {
  const redis = getRedisClient();
  const key = `ratelimit:agent:${apiKey}`;
  const limit = 100; // 100 requests per minute
  const window = 60; // 1 minute

  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, window);
  }

  return current <= limit;
}

// Audit log for agent requests
async function auditAgentRequest(
  agentId: string,
  request: FastifyRequest
): Promise<void> {
  const { method, url, ip, headers } = request;
  const userAgent = headers['user-agent'];
  
  // Log to console (in production, send to audit log)
  console.log(`[AGENT AUDIT] ${new Date().toISOString()} | Agent: ${agentId} | ${method} ${url} | IP: ${ip} | UA: ${userAgent}`);
}

export default fp(async function (app: FastifyInstance) {
  // Agent authentication decorator
  app.decorate('authenticateAgent', async function (request: FastifyRequest, reply: FastifyReply) {
    const apiKey = request.headers['x-agent-api-key'] as string;

    if (!apiKey) {
      return reply.status(401).send({ error: 'API key required' });
    }

    // Rate limiting check
    const allowed = await checkAgentRateLimit(apiKey);
    if (!allowed) {
      return reply.status(429).send({ error: 'Rate limit exceeded', retryAfter: 60 });
    }

    // Verify API key
    const agent = await verifyApiKey(apiKey);
    if (!agent) {
      return reply.status(401).send({ error: 'Invalid API key' });
    }

    // IP whitelist check
    if (agent.ipWhitelist.length > 0) {
      const clientIp = request.ip;
      if (!agent.ipWhitelist.includes(clientIp)) {
        return reply.status(403).send({ error: 'IP not whitelisted' });
      }
    }

    // Audit log
    await auditAgentRequest(agent.id, request);

    // Update online status (async, don't wait)
    const { updateOnlineStatus } = await import('../services/agent.js');
    updateOnlineStatus(agent.id, true).catch(() => {});

    // Attach agent to request
    request.agent = {
      id: agent.id,
      ownerId: agent.ownerId,
      name: agent.name,
    };
  });
});
