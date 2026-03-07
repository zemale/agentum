import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('3001').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  RATE_LIMIT_ENABLED: z.string().default('true').transform((val) => val === 'true'),
  SENTRY_DSN: z.string().optional(),
  RELEASE: z.string().optional(),
  IDEMPOTENCY_TTL: z.string().default('86400').transform(Number).optional(),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  BCRYPT_ROUNDS: z.string().default('10').transform(Number),
});

export type Env = z.infer<typeof envSchema>;

let env: Env;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    const messages = error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    console.error('❌ Invalid environment variables:');
    messages.forEach((msg) => console.error(`  - ${msg}`));
    process.exit(1);
  }
  throw error;
}

export { env };
