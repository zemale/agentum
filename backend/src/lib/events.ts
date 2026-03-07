/**
 * Event Types and Payloads for Agentum Domain Events
 * 
 * This module defines all domain events used in the system,
 * enabling type-safe event handling across the application.
 */

/**
 * Event metadata attached to all domain events
 */
export interface EventMetadata {
  /** Timestamp when the event was created */
  timestamp: string;
  /** Service that emitted the event */
  source: string;
  /** Correlation ID for tracing requests across services */
  correlationId?: string;
  /** User who triggered the event (if applicable) */
  userId?: string;
  /** Additional context */
  [key: string]: unknown;
}

/**
 * Base domain event interface
 */
export interface DomainEvent {
  /** Unique event type identifier */
  type: string;
  /** Aggregate root type (e.g., "task", "wallet", "user") */
  aggregate: string;
  /** ID of the aggregate instance */
  aggregateId: string;
  /** Event-specific payload data */
  payload: EventPayload;
  /** Event metadata */
  metadata?: EventMetadata;
}

/**
 * User registered event
 */
export interface UserRegisteredPayload {
  userId: string;
  email: string;
  name: string;
  initialBalance: number;
}

/**
 * Agent created event
 */
export interface AgentCreatedPayload {
  agentId: string;
  ownerId: string;
  name: string;
  skills: string[];
  hourlyRate: number;
}

/**
 * Task created event
 */
export interface TaskCreatedPayload {
  taskId: string;
  customerId: string;
  agentId: string;
  serviceId?: string;
  title: string;
  budget: number;
  description?: string;
}

/**
 * Task assigned event
 */
export interface TaskAssignedPayload {
  taskId: string;
  customerId: string;
  agentId: string;
  assignedAt: string;
}

/**
 * Task completed event
 */
export interface TaskCompletedPayload {
  taskId: string;
  customerId: string;
  agentId: string;
  result?: string;
  completedAt: string;
}

/**
 * Task approved event
 */
export interface TaskApprovedPayload {
  taskId: string;
  customerId: string;
  agentId: string;
  approvedAt: string;
  paymentAmount: number;
}

/**
 * Escrow lock event
 */
export interface EscrowLockPayload {
  taskId: string;
  userId: string;
  amount: number;
  lockedAt: string;
  transactionId: string;
}

/**
 * Escrow release event
 */
export interface EscrowReleasePayload {
  taskId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  releasedAt: string;
  transactionId: string;
}

/**
 * Payment event
 */
export interface PaymentPayload {
  paymentId: string;
  fromUserId?: string;
  toUserId: string;
  amount: number;
  type: 'TASK_PAYMENT' | 'TASK_REWARD' | 'DEPOSIT' | 'WITHDRAWAL' | 'REFUND';
  taskId?: string;
  processedAt: string;
  transactionId: string;
}

/**
 * Review created event
 */
export interface ReviewCreatedPayload {
  reviewId: string;
  taskId: string;
  agentId: string;
  customerId: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

/**
 * Union type of all event payloads
 */
export type EventPayload =
  | UserRegisteredPayload
  | AgentCreatedPayload
  | TaskCreatedPayload
  | TaskAssignedPayload
  | TaskCompletedPayload
  | TaskApprovedPayload
  | EscrowLockPayload
  | EscrowReleasePayload
  | PaymentPayload
  | ReviewCreatedPayload
  | Record<string, unknown>;

/**
 * Event type constants for type-safe event handling
 */
export const EventTypes = {
  // User events
  USER_REGISTERED: 'UserRegistered',
  
  // Agent events
  AGENT_CREATED: 'AgentCreated',
  
  // Task events
  TASK_CREATED: 'TaskCreated',
  TASK_ASSIGNED: 'TaskAssigned',
  TASK_COMPLETED: 'TaskCompleted',
  TASK_APPROVED: 'TaskApproved',
  
  // Wallet/Financial events
  ESCROW_LOCK: 'EscrowLock',
  ESCROW_RELEASE: 'EscrowRelease',
  PAYMENT: 'Payment',
  
  // Review events
  REVIEW_CREATED: 'ReviewCreated',
} as const;

/**
 * Aggregate type constants
 */
export const Aggregates = {
  USER: 'user',
  AGENT: 'agent',
  TASK: 'task',
  WALLET: 'wallet',
  REVIEW: 'review',
} as const;

/**
 * Type guard for checking if a payload is a specific event type
 */
export function isEventType<T extends EventPayload>(
  event: DomainEvent,
  type: string
): event is DomainEvent & { payload: T } {
  return event.type === type;
}

/**
 * Create a domain event with metadata
 */
export function createEvent(
  type: string,
  aggregate: string,
  aggregateId: string,
  payload: EventPayload,
  metadata?: Partial<EventMetadata>
): DomainEvent {
  return {
    type,
    aggregate,
    aggregateId,
    payload,
    metadata: {
      timestamp: new Date().toISOString(),
      source: 'agentum-backend',
      ...metadata,
    },
  };
}
