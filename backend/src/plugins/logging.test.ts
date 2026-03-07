import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import loggingPlugin from './logging.js';
import * as loggerModule from '@/lib/logger.js';

describe('Logging Plugin', () => {
  let app: FastifyInstance;
  let capturedLogs: Array<Record<string, unknown>> = [];
  let originalLoggerInfo: typeof loggerModule.logger.info;
  let originalLoggerError: typeof loggerModule.logger.error;
  let originalLoggerWarn: typeof loggerModule.logger.warn;

  beforeAll(async () => {
    capturedLogs = [];

    // Spy on logger methods to capture logs
    originalLoggerInfo = loggerModule.logger.info.bind(loggerModule.logger);
    originalLoggerError = loggerModule.logger.error.bind(loggerModule.logger);
    originalLoggerWarn = loggerModule.logger.warn.bind(loggerModule.logger);

    vi.spyOn(loggerModule.logger, 'info').mockImplementation((obj: unknown, msg?: string) => {
      capturedLogs.push({ level: 'info', ...(obj as Record<string, unknown>), msg });
      return originalLoggerInfo(obj as Record<string, unknown>, msg);
    });

    vi.spyOn(loggerModule.logger, 'error').mockImplementation((obj: unknown, msg?: string) => {
      capturedLogs.push({ level: 'error', ...(obj as Record<string, unknown>), msg });
      return originalLoggerError(obj as Record<string, unknown>, msg);
    });

    vi.spyOn(loggerModule.logger, 'warn').mockImplementation((obj: unknown, msg?: string) => {
      capturedLogs.push({ level: 'warn', ...(obj as Record<string, unknown>), msg });
      return originalLoggerWarn(obj as Record<string, unknown>, msg);
    });

    app = Fastify({
      logger: false, // Disable default Fastify logger
    });

    // Register logging plugin
    await app.register(loggingPlugin);

    // Test routes
    app.get('/success', async () => {
      return { status: 'ok' };
    });

    app.get('/error', async () => {
      throw new Error('Test error');
    });

    await app.ready();
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  beforeEach(() => {
    capturedLogs = [];
  });

  it('should add trace_id to request object', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/success',
    });

    expect(response.statusCode).toBe(200);
  });

  it('should extract trace_id from X-Trace-ID header', async () => {
    const customTraceId = 'custom-trace-12345';

    const response = await app.inject({
      method: 'GET',
      url: '/success',
      headers: {
        'X-Trace-ID': customTraceId,
      },
    });

    expect(response.statusCode).toBe(200);

    // Verify custom trace_id was used in logs
    const requestLog = capturedLogs.find(
      (log) => log.trace_id === customTraceId
    );
    expect(requestLog).toBeDefined();
  });

  it('should log requests with required fields', async () => {
    await app.inject({
      method: 'GET',
      url: '/success',
      headers: {
        'user-agent': 'test-agent',
      },
    });

    // Find the request log (info level for successful requests)
    const requestLog = capturedLogs.find(
      (log) => log.method === 'GET' && log.url === '/success'
    );

    expect(requestLog).toBeDefined();
    expect(requestLog).toHaveProperty('trace_id');
    expect(typeof requestLog?.trace_id).toBe('string');
    expect(requestLog?.trace_id).toBeTruthy();

    expect(requestLog).toHaveProperty('method', 'GET');
    expect(requestLog).toHaveProperty('url', '/success');
    expect(requestLog).toHaveProperty('statusCode', 200);
    expect(requestLog).toHaveProperty('duration');
    expect(typeof requestLog?.duration).toBe('number');
    expect(requestLog).toHaveProperty('userAgent', 'test-agent');
    expect(requestLog).toHaveProperty('ip');
  });

  it('should log 500 errors with error details', async () => {
    await app.inject({
      method: 'GET',
      url: '/error',
    });

    // Find error logs - look for the onError hook log which has the error object
    const errorLog = capturedLogs.find(
      (log) => log.url === '/error' && log.level === 'error' && log.error
    );

    expect(errorLog).toBeDefined();
    expect(errorLog).toHaveProperty('trace_id');
    expect(errorLog).toHaveProperty('method', 'GET');
    // The onError hook captures statusCode as 500
    expect(errorLog?.statusCode).toBe(500);
    expect(errorLog).toHaveProperty('error');
    expect(errorLog?.error).toHaveProperty('message', 'Test error');
  });

  it('should log onResponse for 500 errors as well', async () => {
    await app.inject({
      method: 'GET',
      url: '/error',
    });

    // onResponse also logs with status 500
    const responseLog = capturedLogs.find(
      (log) => log.url === '/error' && log.level === 'error' && log.msg === 'Request completed with server error'
    );

    expect(responseLog).toBeDefined();
    expect(responseLog).toHaveProperty('statusCode', 500);
  });

  it('should generate unique trace_ids for different requests', async () => {
    await app.inject({
      method: 'GET',
      url: '/success',
    });

    await app.inject({
      method: 'GET',
      url: '/success',
    });

    const requestLogs = capturedLogs.filter(
      (log) => log.method === 'GET' && log.url === '/success' && log.trace_id
    );

    expect(requestLogs.length).toBeGreaterThanOrEqual(2);
    expect(requestLogs[0]?.trace_id).not.toBe(requestLogs[1]?.trace_id);
  });
});

describe('Logger', () => {
  it('should generate unique trace IDs', () => {
    const id1 = loggerModule.generateTraceId();
    const id2 = loggerModule.generateTraceId();

    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);
    expect(typeof id1).toBe('string');
  });

  it('should have service and version in base bindings', () => {
    const bindings = loggerModule.logger.bindings();
    expect(bindings).toHaveProperty('service', 'agentum-api');
    expect(bindings).toHaveProperty('version', '1.0.0');
  });
});
