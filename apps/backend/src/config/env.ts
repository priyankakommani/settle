import { z } from 'zod';

/**
 * Single source of truth for process configuration.
 * Nothing else in the codebase reads `process.env` directly.
 * Invalid config fails fast, loudly, at boot.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().url(),
  // disable -> no TLS | require -> TLS without CA verification | verify -> TLS + CA verification
  // Unset: inferred from the host (localhost -> disable, anything else -> require).
  DATABASE_SSL: z.enum(['disable', 'require', 'verify']).optional(),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),
  STORAGE_DIR: z.string().default('./.storage'),

  // --- auth ---
  // Secret used to sign session JWTs. Required; must be long enough to matter.
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  // How long a session lasts, in seconds (default 7 days).
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 7),
  // Name of the session cookie.
  SESSION_COOKIE: z.string().default('settle_session'),
  // Password given to every seeded employee so sign-in works out of the box.
  // Unregistered employees (null hash) can still self-register via /auth/signup.
  SEED_DEFAULT_PASSWORD: z.string().min(8).default('Nortex@2026'),
  // Allow the legacy `x-user: <empCode>` header as an identity source.
  // Defaults on outside production so e2e scripts / curl keep working.
  ALLOW_HEADER_AUTH: z
    .enum(['true', 'false'])
    .optional()
    // Preserve undefined so the documented default below can distinguish an
    // omitted setting from an explicit `false`.
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error(
    '❌ Invalid environment configuration:\n',
    JSON.stringify(parsed.error.flatten().fieldErrors, null, 2),
  );
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

/**
 * SSL option shared by every Postgres client (postgres-js at runtime, `pg`
 * inside drizzle-kit). Shape is understood by both drivers.
 * When DATABASE_SSL is unset we infer it: managed providers (Aiven, Neon,
 * Supabase, RDS, ...) require TLS, local Postgres does not.
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '']);
const dbHost = (() => {
  try {
    return new URL(env.DATABASE_URL).hostname;
  } catch {
    return '';
  }
})();

export const dbSslMode: 'disable' | 'require' | 'verify' =
  env.DATABASE_SSL ?? (LOCAL_HOSTS.has(dbHost) ? 'disable' : 'require');

export const dbSsl: false | { rejectUnauthorized: boolean } =
  dbSslMode === 'disable' ? false : { rejectUnauthorized: dbSslMode === 'verify' };

export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export const isDev = env.NODE_ENV === 'development';

/**
 * Whether the `x-user` header may stand in for a real session. Explicit
 * ALLOW_HEADER_AUTH wins; otherwise it's on everywhere except production.
 */
export const allowHeaderAuth: boolean = env.ALLOW_HEADER_AUTH ?? !isProd;
