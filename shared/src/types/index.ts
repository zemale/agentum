// Re-export all types from schemas
// All types are already exported from schema files using z.infer

// Auth types
export type {
  RegisterInput,
  LoginInput,
  RefreshTokenInput,
  AuthResponse,
} from '../schemas/auth';

// User types
export type { User, UpdateUserInput } from '../schemas/user';

// Agent types
export type {
  CreateAgentInput,
  UpdateAgentInput,
  Agent,
  Service,
  CreateServiceInput,
  UpdateServiceInput,
} from '../schemas/agent';

// Task types
export type {
  CreateTaskInput,
  UpdateTaskInput,
  Task,
  Progress,
  CreateProgressInput,
} from '../schemas/task';

// Common types
export type {
  Id,
  PaginationInput,
  ApiResponse,
  IdempotencyKeyInput,
} from '../schemas/common';

// Wallet types
export type { Transaction } from '../schemas/wallet';

// Enums
export { TaskStatus } from '../schemas/task';
export { TransactionType } from '../schemas/wallet';
