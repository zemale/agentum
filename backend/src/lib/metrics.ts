import { Counter, Histogram, Gauge, register } from 'prom-client';

/**
 * Prometheus metrics for Agentum backend
 */

// HTTP request counter with labels: method, route, status_code
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// HTTP request duration histogram with labels: method, route, status_code
export const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 1.0, 2.0, 5.0],
});

// Gauge for online agents count
export const agentOnlineTotal = new Gauge({
  name: 'agent_online_total',
  help: 'Number of agents currently online',
});

// Gauge for total wallet balance (sum of all users)
export const walletBalanceTotal = new Gauge({
  name: 'wallet_balance_total',
  help: 'Total wallet balance across all users',
});

// Gauge for task count by status
export const taskCountByStatus = new Gauge({
  name: 'task_count_by_status',
  help: 'Number of tasks grouped by status',
  labelNames: ['status'],
});

// Gauge for outbox pending queue size
export const outboxPending = new Gauge({
  name: 'outbox_pending',
  help: 'Number of pending messages in outbox queue',
});

/**
 * Get all metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * Get content type for metrics endpoint
 */
export function getMetricsContentType(): string {
  return register.contentType;
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics(): void {
  register.resetMetrics();
}

// Export the register for advanced use cases
export { register };
