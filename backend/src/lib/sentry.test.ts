import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock variables (must be declared before vi.mock due to hoisting)
const mockFns = {
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
  addBreadcrumb: vi.fn(),
  flush: vi.fn(),
  httpIntegration: vi.fn(() => ({ name: 'Http' })),
  expressIntegration: vi.fn(() => ({ name: 'Express' })),
  setupFastifyErrorHandler: vi.fn(),
  withScope: vi.fn((callback) => {
    const mockScope = {
      setContext: vi.fn(),
      setUser: vi.fn(),
      setTag: vi.fn(),
    };
    callback(mockScope);
  }),
};

const profilingMocks = {
  nodeProfilingIntegration: vi.fn(() => ({ name: 'Profiling' })),
};

// Mock env BEFORE any other imports
vi.mock('@/config/env.js', () => ({
  env: {
    NODE_ENV: 'development',
    PORT: 3001,
    LOG_LEVEL: 'info',
    DATABASE_URL: 'postgresql://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
  },
}));

// Mock Sentry
vi.mock('@sentry/node', () => ({
  init: (...args: unknown[]) => mockFns.init(...args),
  captureException: (...args: unknown[]) => mockFns.captureException(...args),
  captureMessage: (...args: unknown[]) => mockFns.captureMessage(...args),
  setUser: (...args: unknown[]) => mockFns.setUser(...args),
  addBreadcrumb: (...args: unknown[]) => mockFns.addBreadcrumb(...args),
  withScope: (...args: unknown[]) => mockFns.withScope(...args),
  flush: (...args: unknown[]) => mockFns.flush(...args),
  httpIntegration: () => mockFns.httpIntegration(),
  expressIntegration: () => mockFns.expressIntegration(),
  setupFastifyErrorHandler: () => mockFns.setupFastifyErrorHandler(),
}));

vi.mock('@sentry/profiling-node', () => ({
  nodeProfilingIntegration: () => profilingMocks.nodeProfilingIntegration(),
}));

// Mock fs for reading package.json
vi.mock('fs', () => ({
  readFileSync: vi.fn(() => JSON.stringify({ name: 'test-app', version: '1.0.0' })),
}));

// Now import the sentry module
import { initSentry, captureException, captureMessage, setUser, addBreadcrumb, Sentry } from './sentry.js';

describe('Sentry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set SENTRY_DSN for tests
    process.env.SENTRY_DSN = 'https://test@sentry.io/123';
  });

  afterEach(() => {
    delete process.env.SENTRY_DSN;
    delete process.env.RELEASE;
  });

  describe('initSentry', () => {
    it('should initialize Sentry when DSN is provided', () => {
      initSentry();

      expect(mockFns.init).toHaveBeenCalled();
      expect(mockFns.init).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://test@sentry.io/123',
          environment: 'development',
          tracesSampleRate: 1.0,
          profilesSampleRate: 1.0,
          debug: true,
        })
      );
    });

    it('should not initialize Sentry when DSN is not provided', () => {
      delete process.env.SENTRY_DSN;
      initSentry();

      expect(mockFns.init).not.toHaveBeenCalled();
    });

    it('should use RELEASE env var if available', () => {
      process.env.RELEASE = 'custom-release-1.2.3';
      initSentry();

      expect(mockFns.init).toHaveBeenCalledWith(
        expect.objectContaining({
          release: 'custom-release-1.2.3',
        })
      );
    });

    it('should include required integrations', () => {
      initSentry();

      expect(mockFns.init).toHaveBeenCalledWith(
        expect.objectContaining({
          integrations: expect.arrayContaining([
            expect.objectContaining({ name: 'Http' }),
            expect.objectContaining({ name: 'Express' }),
            expect.objectContaining({ name: 'Profiling' }),
          ]),
        })
      );
    });
  });

  describe('captureException', () => {
    it('should capture exception without context', () => {
      const error = new Error('Test error');
      captureException(error);

      expect(mockFns.captureException).toHaveBeenCalledWith(error);
    });

    it('should capture exception with context using scope', () => {
      const error = new Error('Test error with context');
      const context = { userId: '123', action: 'test' };
      
      captureException(error, context);

      expect(mockFns.withScope).toHaveBeenCalled();
      expect(mockFns.captureException).toHaveBeenCalledWith(error);
    });
  });

  describe('captureMessage', () => {
    it('should capture message with default level', () => {
      captureMessage('Test message');

      expect(mockFns.captureMessage).toHaveBeenCalledWith('Test message', 'info');
    });

    it('should capture message with custom level', () => {
      captureMessage('Warning message', 'warning');

      expect(mockFns.captureMessage).toHaveBeenCalledWith('Warning message', 'warning');
    });
  });

  describe('setUser', () => {
    it('should set user context', () => {
      const user = { id: 'user-123', email: 'test@example.com', username: 'testuser' };
      setUser(user);

      expect(mockFns.setUser).toHaveBeenCalledWith(user);
    });

    it('should clear user context when null is passed', () => {
      setUser(null);

      expect(mockFns.setUser).toHaveBeenCalledWith(null);
    });
  });

  describe('addBreadcrumb', () => {
    it('should add breadcrumb', () => {
      const breadcrumb = {
        category: 'auth',
        message: 'User logged in',
        level: 'info' as const,
      };
      addBreadcrumb(breadcrumb);

      expect(mockFns.addBreadcrumb).toHaveBeenCalledWith(breadcrumb);
    });
  });

  describe('Sentry export', () => {
    it('should export Sentry client with expected methods', () => {
      expect(Sentry).toBeDefined();
      expect(typeof Sentry.init).toBe('function');
      expect(typeof Sentry.captureException).toBe('function');
      expect(typeof Sentry.captureMessage).toBe('function');
      expect(typeof Sentry.setUser).toBe('function');
    });
  });
});
