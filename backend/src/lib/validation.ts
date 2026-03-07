/**
 * Validation utilities using shared Zod schemas
 * 
 * This module demonstrates how to use the shared schemas
 * for validation throughout the backend.
 */

import {
  // Auth schemas
  RegisterSchema,
  LoginSchema,
  RefreshTokenSchema,
  AuthResponseSchema,
  
  // User schemas
  UserSchema,
  UpdateUserSchema,
  
  // Agent schemas
  CreateAgentSchema,
  UpdateAgentSchema,
  AgentSchema,
  CreateServiceSchema,
  
  // Task schemas
  CreateTaskSchema,
  UpdateTaskSchema,
  TaskSchema,
  CreateProgressSchema,
  TaskStatus,
  
  // Common schemas
  IdSchema,
  PaginationSchema,
  ApiResponseSchema,
  
  // Types
  type RegisterInput,
  type LoginInput,
  type AuthResponse,
  type User,
  type CreateAgentInput,
  type Agent,
  type CreateTaskInput,
  type Task,
  type PaginationInput,
  type ApiResponse,
} from '@agentum/shared';
import { z } from 'zod';

/**
 * Validate data against a schema
 * Returns the parsed data or throws a ZodError
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Validate data against a schema safely
 * Returns an object with success flag and either data or error
 */
export function validateSafe<T>(schema: z.ZodSchema<T>, data: unknown): 
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: z.ZodError } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}

/**
 * Format Zod error into a user-friendly message
 */
export function formatZodError(error: z.ZodError): string {
  return error.errors
    .map((err) => `${err.path.join('.')}: ${err.message}`)
    .join('; ');
}

// ============================================
// Auth Validation Helpers
// ============================================

export function validateRegisterInput(data: unknown): RegisterInput {
  return validate(RegisterSchema, data);
}

export function validateLoginInput(data: unknown): LoginInput {
  return validate(LoginSchema, data);
}

export function validateAuthResponse(data: unknown): AuthResponse {
  return validate(AuthResponseSchema, data);
}

// ============================================
// User Validation Helpers
// ============================================

export function validateUser(data: unknown): User {
  return validate(UserSchema, data);
}

// ============================================
// Agent Validation Helpers
// ============================================

export function validateCreateAgentInput(data: unknown): CreateAgentInput {
  return validate(CreateAgentSchema, data);
}

export function validateAgent(data: unknown): Agent {
  return validate(AgentSchema, data);
}

// ============================================
// Task Validation Helpers
// ============================================

export function validateCreateTaskInput(data: unknown): CreateTaskInput {
  return validate(CreateTaskSchema, data);
}

export function validateTask(data: unknown): Task {
  return validate(TaskSchema, data);
}

// ============================================
// Common Validation Helpers
// ============================================

export function validateId(data: unknown): string {
  return validate(IdSchema, data);
}

export function validatePagination<T>(data: unknown): T {
  return validate(PaginationSchema, data) as T;
}

export function validateApiResponse(data: unknown): ApiResponse {
  return validate(ApiResponseSchema, data);
}

// ============================================
// Example usage functions
// ============================================

/**
 * Example: Validate user registration
 */
export function exampleRegisterValidation() {
  // Valid registration data
  const validData = {
    email: 'user@example.com',
    password: 'securepassword123',
    name: 'John Doe',
  };

  const result = validateSafe(RegisterSchema, validData);
  
  if (result.success) {
    console.log('Valid registration data:', result.data);
  } else {
    console.error('Validation failed:', formatZodError(result.error));
  }

  // Invalid registration data (password too short)
  const invalidData = {
    email: 'user@example.com',
    password: 'short',
    name: 'John Doe',
  };

  const invalidResult = validateSafe(RegisterSchema, invalidData);
  
  if (!invalidResult.success) {
    console.error('Expected validation error:', formatZodError(invalidResult.error));
  }
}

/**
 * Example: Validate pagination params
 */
export function examplePaginationValidation() {
  const queryParams = {
    page: 1,
    limit: 20,
  };

  const pagination = validatePagination(queryParams);
  console.log('Pagination:', pagination);
}

/**
 * Example: Validate with TaskStatus enum
 */
export function exampleTaskStatusValidation() {
  const taskData = {
    agentId: 'agent_123',
    title: 'My Task',
    description: 'Task description',
    budget: 100,
    status: TaskStatus.CREATED,
  };

  const result = validateSafe(CreateTaskSchema, taskData);
  
  if (result.success) {
    console.log('Valid task data:', result.data);
  }
}
