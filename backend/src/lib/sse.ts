/**
 * SSE (Server-Sent Events) Manager
 * 
 * Manages SSE connections for real-time updates:
 * - Customer connections (authenticated via JWT)
 * - Agent connections (authenticated via API key)
 * - Broadcasting messages to specific channels
 * - Redis Pub/Sub integration for multi-instance support
 */

import { EventEmitter } from 'events';
import { logger } from './logger.js';
import { getRedisClient } from './redis.js';

interface Connection {
  id: string;
  userId?: string;
  agentId?: string;
  type: 'customer' | 'agent';
  emit: (data: string) => void;
  close: () => void;
  connectedAt: Date;
  lastPingAt: Date;
}

interface SSEMessage {
  type: string;
  payload: unknown;
  timestamp: string;
}

// Connection maps
const customerConnections = new Map<string, Set<Connection>>();
const agentConnections = new Map<string, Set<Connection>>();

// Event emitter for local events
const localEmitter = new EventEmitter();

// Redis channels
const REDIS_CHANNEL_CUSTOMERS = 'sse:customers';
const REDIS_CHANNEL_AGENTS = 'sse:agents';

/**
 * Initialize SSE manager with Redis Pub/Sub
 */
export async function initSSEManager(): Promise<void> {
  try {
    const redis = getRedisClient();

    // Subscribe to Redis channels for cross-instance messaging
    await redis.subscribe(REDIS_CHANNEL_CUSTOMERS, REDIS_CHANNEL_AGENTS);

    redis.on('message', (channel, message) => {
      try {
        const data = JSON.parse(message);
        if (channel === REDIS_CHANNEL_CUSTOMERS) {
          broadcastToCustomerLocal(data.userId, data.message);
        } else if (channel === REDIS_CHANNEL_AGENTS) {
          broadcastToAgentLocal(data.agentId, data.message);
        }
      } catch (err) {
        logger.error({ err, channel }, 'Failed to process Redis message');
      }
    });

    logger.info('SSE Manager initialized with Redis');
  } catch (err) {
    logger.error({ err }, 'Failed to initialize SSE Manager');
    // Continue without Redis - local broadcasting only
  }
}

/**
 * Add a customer connection
 */
export function addCustomerConnection(userId: string, connection: Connection): void {
  if (!customerConnections.has(userId)) {
    customerConnections.set(userId, new Set());
  }
  customerConnections.get(userId)!.add(connection);

  logger.debug(
    { userId, connectionId: connection.id, total: customerConnections.get(userId)!.size },
    'Customer SSE connection added'
  );

  // Send initial connection message
  sendToConnection(connection, {
    type: 'connected',
    payload: { userId, timestamp: new Date().toISOString() },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Remove a customer connection
 */
export function removeCustomerConnection(userId: string, connection: Connection): void {
  const connections = customerConnections.get(userId);
  if (connections) {
    connections.delete(connection);
    if (connections.size === 0) {
      customerConnections.delete(userId);
    }
  }

  logger.debug(
    { userId, connectionId: connection.id, remaining: connections?.size || 0 },
    'Customer SSE connection removed'
  );
}

/**
 * Add an agent connection
 */
export function addAgentConnection(agentId: string, connection: Connection): void {
  if (!agentConnections.has(agentId)) {
    agentConnections.set(agentId, new Set());
  }
  agentConnections.get(agentId)!.add(connection);

  logger.debug(
    { agentId, connectionId: connection.id, total: agentConnections.get(agentId)!.size },
    'Agent SSE connection added'
  );

  // Send initial connection message
  sendToConnection(connection, {
    type: 'connected',
    payload: { agentId, timestamp: new Date().toISOString() },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Remove an agent connection
 */
export function removeAgentConnection(agentId: string, connection: Connection): void {
  const connections = agentConnections.get(agentId);
  if (connections) {
    connections.delete(connection);
    if (connections.size === 0) {
      agentConnections.delete(agentId);
    }
  }

  logger.debug(
    { agentId, connectionId: connection.id, remaining: connections?.size || 0 },
    'Agent SSE connection removed'
  );
}

/**
 * Send message to a specific connection
 */
function sendToConnection(connection: Connection, message: SSEMessage): void {
  try {
    const data = `data: ${JSON.stringify(message)}\n\n`;
    connection.emit(data);
  } catch (err) {
    logger.error({ err, connectionId: connection.id }, 'Failed to send SSE message');
    connection.close();
  }
}

/**
 * Broadcast to customer (local + Redis)
 */
export async function broadcastToCustomer(userId: string, message: SSEMessage): Promise<void> {
  // Send locally
  broadcastToCustomerLocal(userId, message);

  // Publish to Redis for other instances
  try {
    const redis = getRedisClient();
    await redis.publish(
      REDIS_CHANNEL_CUSTOMERS,
      JSON.stringify({ userId, message })
    );
  } catch (err) {
    logger.error({ err, userId }, 'Failed to publish to Redis');
  }
}

/**
 * Broadcast to customer (local only)
 */
function broadcastToCustomerLocal(userId: string, message: SSEMessage): void {
  const connections = customerConnections.get(userId);
  if (!connections || connections.size === 0) {
    return;
  }

  const deadConnections: Connection[] = [];

  for (const connection of connections) {
    try {
      sendToConnection(connection, message);
    } catch (err) {
      deadConnections.push(connection);
    }
  }

  // Clean up dead connections
  for (const conn of deadConnections) {
    removeCustomerConnection(userId, conn);
  }
}

/**
 * Broadcast to agent (local + Redis)
 */
export async function broadcastToAgent(agentId: string, message: SSEMessage): Promise<void> {
  // Send locally
  broadcastToAgentLocal(agentId, message);

  // Publish to Redis for other instances
  try {
    const redis = getRedisClient();
    await redis.publish(
      REDIS_CHANNEL_AGENTS,
      JSON.stringify({ agentId, message })
    );
  } catch (err) {
    logger.error({ err, agentId }, 'Failed to publish to Redis');
  }
}

/**
 * Broadcast to agent (local only)
 */
function broadcastToAgentLocal(agentId: string, message: SSEMessage): void {
  const connections = agentConnections.get(agentId);
  if (!connections || connections.size === 0) {
    return;
  }

  const deadConnections: Connection[] = [];

  for (const connection of connections) {
    try {
      sendToConnection(connection, message);
    } catch (err) {
      deadConnections.push(connection);
    }
  }

  // Clean up dead connections
  for (const conn of deadConnections) {
    removeAgentConnection(agentId, conn);
  }
}

/**
 * Broadcast task update to customer
 */
export async function notifyTaskUpdate(
  userId: string,
  taskId: string,
  update: Record<string, unknown>
): Promise<void> {
  await broadcastToCustomer(userId, {
    type: 'task.updated',
    payload: { taskId, ...update },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast progress update to customer
 */
export async function notifyProgressUpdate(
  userId: string,
  taskId: string,
  progress: Record<string, unknown>
): Promise<void> {
  await broadcastToCustomer(userId, {
    type: 'task.progress',
    payload: { taskId, progress },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast task assignment to agent
 */
export async function notifyTaskAssigned(
  agentId: string,
  task: Record<string, unknown>
): Promise<void> {
  await broadcastToAgent(agentId, {
    type: 'task.assigned',
    payload: task,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get connection statistics
 */
export function getConnectionStats(): {
  customers: number;
  agents: number;
  totalConnections: number;
} {
  let totalConnections = 0;

  for (const connections of customerConnections.values()) {
    totalConnections += connections.size;
  }

  for (const connections of agentConnections.values()) {
    totalConnections += connections.size;
  }

  return {
    customers: customerConnections.size,
    agents: agentConnections.size,
    totalConnections,
  };
}

/**
 * Generate a unique connection ID
 */
export function generateConnectionId(): string {
  return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export type { Connection, SSEMessage };
