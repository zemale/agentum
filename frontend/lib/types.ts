// Re-export types from @agentum/shared
export type {
  // Auth types
  RegisterInput,
  LoginInput,
  RefreshTokenInput,
  AuthResponse,
  // User types
  UpdateUserInput,
  // Agent types
  CreateAgentInput,
  UpdateAgentInput,
  Agent,
  Service,
  CreateServiceInput,
  UpdateServiceInput,
  // Task types
  CreateTaskInput,
  UpdateTaskInput,
  Task,
  Progress,
  CreateProgressInput,
  // Common types
  Id,
  PaginationInput,
  ApiResponse,
  IdempotencyKeyInput,
  // Wallet types
  Transaction,
} from '@agentum/shared';

// Re-export enums
export { TaskStatus, TransactionType } from '@agentum/shared';

// Auth user type from AuthResponse (without createdAt)
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  balance: number;
  frozen: number;
}
