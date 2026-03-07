import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateTraceId, createChildLogger, logger } from './logger.js';

describe('Logger', () => {
  describe('generateTraceId', () => {
    it('should generate a unique trace ID', () => {
      const traceId1 = generateTraceId();
      const traceId2 = generateTraceId();

      expect(traceId1).toBeDefined();
      expect(traceId2).toBeDefined();
      expect(traceId1).not.toBe(traceId2);
      expect(typeof traceId1).toBe('string');
      expect(traceId1.length).toBeGreaterThan(0);
    });

    it('should generate trace ID in expected format (timestamp-random)', () => {
      const traceId = generateTraceId();
      const parts = traceId.split('-');

      expect(parts).toHaveLength(2);
      expect(parts[0]).toMatch(/^[a-z0-9]+$/); // base36 timestamp
      expect(parts[1]).toMatch(/^[a-z0-9]+$/); // base36 random
    });
  });

  describe('createChildLogger', () => {
    it('should create a child logger with trace_id binding', () => {
      const traceId = 'test-trace-id-123';
      const childLogger = createChildLogger(traceId);

      expect(childLogger).toBeDefined();
      expect(childLogger.bindings).toBeDefined();
      expect(childLogger.bindings()).toHaveProperty('trace_id', traceId);
    });

    it('should include extra bindings in child logger', () => {
      const traceId = 'test-trace-id-456';
      const extraBindings = { userId: 'user-123', requestId: 'req-789' };
      const childLogger = createChildLogger(traceId, extraBindings);

      const bindings = childLogger.bindings();
      expect(bindings).toHaveProperty('trace_id', traceId);
      expect(bindings).toHaveProperty('userId', 'user-123');
      expect(bindings).toHaveProperty('requestId', 'req-789');
    });

    it('should create independent child loggers', () => {
      const childLogger1 = createChildLogger('trace-1', { userId: 'user-1' });
      const childLogger2 = createChildLogger('trace-2', { userId: 'user-2' });

      expect(childLogger1.bindings()).toHaveProperty('trace_id', 'trace-1');
      expect(childLogger1.bindings()).toHaveProperty('userId', 'user-1');
      expect(childLogger2.bindings()).toHaveProperty('trace_id', 'trace-2');
      expect(childLogger2.bindings()).toHaveProperty('userId', 'user-2');
    });
  });

  describe('logger instance', () => {
    it('should have standard log methods', () => {
      expect(typeof logger.trace).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.fatal).toBe('function');
    });

    it('should have child method', () => {
      expect(typeof logger.child).toBe('function');
    });
  });
});
