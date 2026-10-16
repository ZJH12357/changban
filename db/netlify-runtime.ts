import { getConnectionString, getDatabase } from '@netlify/database';
import { createPostgresDatabase, type PgPool } from './postgres-adapter';

// Do not connect at import/build time. The SDK selects the production or preview
// database branch supplied by Netlify. No Cloudflare credential or fallback.
export const localPreview = false;
let cached: ReturnType<typeof getDatabase> | undefined;
let connection: string | undefined;
const adapter = createPostgresDatabase(() => {
  const current = getConnectionString();
  if (!cached || connection !== current) {
    const previous = cached;
    cached = getDatabase();
    connection = current;
    // Reuse a pool across warm Function calls, but allow rotated credentials.
    if (previous) void previous.pool.end().catch(() => {});
  }
  return cached.pool as unknown as PgPool;
});
export function database(): D1Database { return adapter; }
