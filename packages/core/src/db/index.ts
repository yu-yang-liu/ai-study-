import { getLocalDatabaseClient } from './sqlite';
import type { LocalDatabaseClient } from './sqlite';

/** Compatibility name retained for callers while the storage backend is local. */
export type SupabaseClient = LocalDatabaseClient;
export type { LocalDatabaseClient } from './sqlite';
export { getLocalDatabase, getLocalDatabasePath, getLocalDatabaseClient } from './sqlite';

/** Returns the local SQLite client used by both web and background code. */
export function createAnonClient(): LocalDatabaseClient {
  return getLocalDatabaseClient();
}

/** Returns the local SQLite client. There is no service-role key or remote RLS boundary anymore. */
export function createServiceClient(): LocalDatabaseClient {
  return getLocalDatabaseClient();
}

export function getServiceClient(): LocalDatabaseClient {
  return getLocalDatabaseClient();
}

/**
 * Kept as an explicit failure so an old migration script cannot silently try to
 * connect to the retired PostgreSQL/Supabase instance.
 */
export function createDrizzleClient(): never {
  throw new Error('PostgreSQL/Drizzle is not configured. Use the local SQLite client instead.');
}

// The old Drizzle schema remains available for type-only consumers during the
// transition, but it is not imported by the runtime storage path.
export * as schema from './schema';
