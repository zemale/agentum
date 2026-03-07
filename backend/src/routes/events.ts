import type { FastifyInstance } from 'fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import {
  addCustomerConnection,
  removeCustomerConnection,
  addAgentConnection,
  removeAgentConnection,
  generateConnectionId,
  type Connection,
} from '../lib/sse.js';
import { verifyApiKey, updateOnlineStatus } from '../services/agent.js';
import { logger } from '../lib/logger.js';

/**
 * SSE Routes for real-time events
 * 
 * - GET /events/stream - Customer SSE stream (JWT auth)
 * - GET /api/v1/agent/events/stream - Agent SSE stream (API key auth)
 */

export default async function eventRoutes(app: FastifyInstance) {
  // Customer SSE endpoint (authenticated)
  app.get('/stream', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const connectionId = generateConnectionId();

    // Set headers for SSE
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    // Send initial headers
    reply.raw.write(':ok\n\n');

    // Create connection object
    const connection: Connection = {
      id: connectionId,
      userId,
      type: 'customer',
      emit: (data: string) => {
        try {
          reply.raw.write(data);
        } catch (err) {
          logger.error({ err, connectionId }, 'Failed to write to SSE stream');
          cleanup();
        }
      },
      close: () => {
        try {
          reply.raw.end();
        } catch {
          // Ignore errors on close
        }
      },
      connectedAt: new Date(),
      lastPingAt: new Date(),
    };

    // Add to connections
    addCustomerConnection(userId, connection);

    // Setup cleanup
    const cleanup = () => {
      removeCustomerConnection(userId, connection);
    };

    // Handle client disconnect
    request.raw.on('close', cleanup);
    request.raw.on('error', cleanup);
    request.raw.on('end', cleanup);

    // Send heartbeat every 30 seconds
    const heartbeatInterval = setInterval(() => {
      try {
        reply.raw.write(':heartbeat\n\n');
        connection.lastPingAt = new Date();
      } catch (err) {
        logger.error({ err, connectionId }, 'Heartbeat failed');
        clearInterval(heartbeatInterval);
        cleanup();
      }
    }, 30000);

    // Clean up on close
    reply.raw.on('close', () => {
      clearInterval(heartbeatInterval);
      cleanup();
    });

    // Keep the connection open
    return new Promise(() => {});
  });

  // Agent SSE endpoint (authenticated via API key)
  app.get('/api/v1/agent/events/stream', async (request, reply) => {
    const apiKey = request.headers['x-agent-api-key'] as string;

    if (!apiKey) {
      return reply.status(401).send({ error: 'API key required' });
    }

    // Verify API key
    const agent = await verifyApiKey(apiKey);

    if (!agent) {
      return reply.status(401).send({ error: 'Invalid API key' });
    }

    const agentId = agent.id;
    const connectionId = generateConnectionId();

    // Set headers for SSE
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Send initial headers
    reply.raw.write(':ok\n\n');

    // Update agent online status
    await updateOnlineStatus(agentId, true);

    // Create connection object
    const connection: Connection = {
      id: connectionId,
      agentId,
      type: 'agent',
      emit: (data: string) => {
        try {
          reply.raw.write(data);
        } catch (err) {
          logger.error({ err, connectionId, agentId }, 'Failed to write to agent SSE stream');
          cleanup();
        }
      },
      close: () => {
        try {
          reply.raw.end();
        } catch {
          // Ignore errors on close
        }
      },
      connectedAt: new Date(),
      lastPingAt: new Date(),
    };

    // Add to connections
    addAgentConnection(agentId, connection);

    // Setup cleanup
    const cleanup = async () => {
      removeAgentConnection(agentId, connection);
      // Set offline after a delay (in case of quick reconnect)
      setTimeout(async () => {
        await updateOnlineStatus(agentId, false);
      }, 5000);
    };

    // Handle client disconnect
    request.raw.on('close', cleanup);
    request.raw.on('error', cleanup);
    request.raw.on('end', cleanup);

    // Send heartbeat every 30 seconds
    const heartbeatInterval = setInterval(() => {
      try {
        reply.raw.write(':heartbeat\n\n');
        connection.lastPingAt = new Date();
      } catch (err) {
        logger.error({ err, connectionId, agentId }, 'Agent heartbeat failed');
        clearInterval(heartbeatInterval);
        cleanup();
      }
    }, 30000);

    // Clean up on close
    reply.raw.on('close', () => {
      clearInterval(heartbeatInterval);
      cleanup();
    });

    // Keep the connection open
    return new Promise(() => {});
  });

  // Get SSE stats (admin/debug)
  app.get('/stats', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { getConnectionStats } = await import('../lib/sse.js');
    const stats = getConnectionStats();

    return reply.send({
      connections: stats,
    });
  });
}
