/**
 * Idempotency Key Generator
 * 
 * Utility functions for generating idempotency keys on the frontend/client side.
 * These keys are used to ensure safe retries of API requests without duplicate processing.
 * 
 * @example
 * ```typescript
 * import { generateIdempotencyKey } from '@/lib/idempotency-key.js';
 * 
 * const key = generateIdempotencyKey();
 * await fetch('/api/orders', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Idempotency-Key': key,
 *   },
 *   body: JSON.stringify({ item: 'product-123' }),
 * });
 * ```
 */

/**
 * Generate a random UUID v4 string
 * Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * where x is any hexadecimal digit and y is one of 8, 9, A, or B
 */
function generateUUIDv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.random() * 16 | 0;
    const value = char === 'x' ? random : (random & 0x3 | 0x8);
    return value.toString(16);
  });
}

/**
 * Generate a cryptographically secure random UUID v4 string
 * Uses crypto.randomUUID() if available (Node.js 14.17+, modern browsers),
 * falls back to Math.random() based implementation otherwise.
 */
function generateSecureUUIDv4(): string {
  // Check if crypto.randomUUID is available (Node.js 14.17+, modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Check if we're in Node.js environment
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      // Dynamic import to avoid issues in browser environments
      const nodeCrypto = require('crypto');
      if (nodeCrypto.randomUUID) {
        return nodeCrypto.randomUUID();
      }
    } catch {
      // Fallback to Math.random() implementation
    }
  }

  // Fallback to Math.random() based UUID generation
  return generateUUIDv4();
}

/**
 * Generate an idempotency key for API requests
 * 
 * Uses UUID v4 format which provides:
 * - 122 bits of randomness
 * - Extremely low collision probability
 * - Standard format recognized across systems
 * 
 * @returns A UUID v4 string suitable for use as an idempotency key
 * 
 * @example
 * ```typescript
 * const key = generateIdempotencyKey();
 * // Result: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
 * ```
 */
export function generateIdempotencyKey(): string {
  return generateSecureUUIDv4();
}

/**
 * Generate an idempotency key with a prefix
 * Useful for identifying the type of operation
 * 
 * @param prefix - A string prefix to add to the key
 * @returns A prefixed idempotency key
 * 
 * @example
 * ```typescript
 * const key = generatePrefixedIdempotencyKey('order');
 * // Result: 'order_f47ac10b-58cc-4372-a567-0e02b2c3d479'
 * ```
 */
export function generatePrefixedIdempotencyKey(prefix: string): string {
  return `${prefix}_${generateIdempotencyKey()}`;
}

/**
 * Validate that a string is a valid UUID v4 format
 * 
 * @param value - The string to validate
 * @returns True if the string is a valid UUID v4
 * 
 * @example
 * ```typescript
 * isValidUUIDv4('f47ac10b-58cc-4372-a567-0e02b2c3d479'); // true
 * isValidUUIDv4('not-a-uuid'); // false
 * ```
 */
export function isValidUUIDv4(value: string): boolean {
  const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidv4Regex.test(value);
}

/**
 * Generate a unique key for a specific operation with context
 * Combines operation type, entity ID, and random component for uniqueness
 * 
 * @param operation - The operation type (e.g., 'create-order', 'update-user')
 * @param entityId - Optional entity identifier
 * @returns A context-aware idempotency key
 * 
 * @example
 * ```typescript
 * const key = generateOperationKey('create-order', 'user-123');
 * // Result: 'create-order:user-123:f47ac10b-58cc-4372-a567-0e02b2c3d479'
 * ```
 */
export function generateOperationKey(operation: string, entityId?: string): string {
  const base = entityId ? `${operation}:${entityId}` : operation;
  return `${base}:${generateIdempotencyKey()}`;
}
