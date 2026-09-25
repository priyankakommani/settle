import { defineConfig } from 'drizzle-kit';

/**
 * Build-tool config for drizzle-kit (generate / migrate / studio).
 * This is the one place besides src/config/env.ts allowed to read
 * process.env directly — drizzle-kit loads this file outside the app runtime.
 *
 * Type-checked via tsconfig.tools.json (this file is outside src/).
 *
 * NOTE: drizzle-kit ignores `dbCredentials.ssl` whenever a `url` is supplied
 * (it forwards only the connection string, so `pg` derives SSL from the URL's
 * `sslmode` and rejects self-signed chains). We therefore expand the URL into
 * discrete fields so our explicit `ssl` option is actually honoured.
 */
const rawUrl = process.env.DATABASE_URL ?? 'postgres://settle:settle@localhost:5432/settle';
const u = new URL(rawUrl);

// Mirrors DATABASE_SSL in src/config/env.ts: unset -> inferred from the host
// (localhost needs no TLS; managed providers like Aiven require it).
const isLocal = ['localhost', '127.0.0.1', '::1', '[::1]', ''].includes(u.hostname);
const sslMode = process.env.DATABASE_SSL ?? (isLocal ? 'disable' : 'require');
const ssl =
  sslMode === 'disable' ? false : { rejectUnauthorized: sslMode === 'verify' };

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: u.hostname,
    port: u.port ? Number(u.port) : 5432,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.replace(/^\//, '')),
    ssl,
  },
  verbose: true,
  strict: true,
});
