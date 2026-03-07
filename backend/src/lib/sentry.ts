import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { env } from '@/config/env.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

/**
 * Get release version from package.json or environment variable
 */
function getRelease(): string | undefined {
  // Check for environment variable first
  if (process.env.RELEASE) {
    return process.env.RELEASE;
  }

  try {
    // Try to read package.json for version
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const packageJsonPath = join(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return `${packageJson.name}@${packageJson.version}`;
  } catch {
    // Fallback to undefined if we can't determine version
    return undefined;
  }
}

/**
 * Determine if we're in development mode
 */
const isDevelopment = env.NODE_ENV === 'development';

/**
 * Initialize Sentry with configuration
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.warn('⚠️  SENTRY_DSN not set. Sentry is disabled.');
    return;
  }

  Sentry.init({
    dsn,
    environment: env.NODE_ENV,
    release: getRelease(),
    
    // Integrations
    integrations: [
      // HTTP integration to trace outgoing requests
      Sentry.httpIntegration(),
      // Express integration for Fastify compatibility
      Sentry.expressIntegration(),
      // Profiling integration
      nodeProfilingIntegration(),
    ],

    // Traces sample rate: 1.0 in dev, 0.1 in prod
    tracesSampleRate: isDevelopment ? 1.0 : 0.1,

    // Profiles sample rate: 1.0 in dev, 0.1 in prod
    profilesSampleRate: isDevelopment ? 1.0 : 0.1,

    // Enable debug mode in development
    debug: isDevelopment,

    // Before send to filter/sanitize data
    beforeSend(event) {
      // Sanitize sensitive data from events
      if (event.request) {
        // Remove authorization headers
        if (event.request.headers) {
          const headers = { ...event.request.headers };
          delete headers.authorization;
          delete headers['x-api-key'];
          delete headers.cookie;
          event.request.headers = headers;
        }

        // Sanitize request data
        if (event.request.data) {
          try {
            const data = typeof event.request.data === 'string' 
              ? JSON.parse(event.request.data) 
              : event.request.data;
            
            // Remove sensitive fields from body
            const sanitizedData = { ...data };
            delete sanitizedData.password;
            delete sanitizedData.token;
            delete sanitizedData.secret;
            delete sanitizedData.apiKey;
            delete sanitizedData.api_key;
            delete sanitizedData.accessToken;
            delete sanitizedData.access_token;
            delete sanitizedData.refreshToken;
            delete sanitizedData.refresh_token;
            
            event.request.data = sanitizedData;
          } catch {
            // If we can't parse the data, leave it as is
          }
        }
      }

      return event;
    },
  });

  console.log(`✅ Sentry initialized (${env.NODE_ENV} mode)`);
}

/**
 * Get the Sentry client (for manual error capture)
 */
export { Sentry };

/**
 * Capture an exception with Sentry
 */
export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (context) {
    Sentry.withScope((scope) => {
      scope.setContext('additional', context);
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

/**
 * Capture a message with Sentry
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
  Sentry.captureMessage(message, level);
}

/**
 * Set user context for Sentry
 */
export function setUser(user: { id: string; email?: string; username?: string } | null): void {
  Sentry.setUser(user);
}

/**
 * Add breadcrumb to Sentry
 */
export function addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
  Sentry.addBreadcrumb(breadcrumb);
}
