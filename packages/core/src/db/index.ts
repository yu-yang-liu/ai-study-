import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type { SupabaseClient };
export { schema };

function getSupabaseUrl(): string {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  }
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

/** Anon client �?safe for server and client. Uses anon key, subject to RLS. */
export function createAnonClient(): SupabaseClient {
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return createClient(getSupabaseUrl(), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Service-role client �?SERVER ONLY. Bypasses RLS. For admin/RAG/metering. */
export function createServiceClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('Service role client must not be used in browser');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(getSupabaseUrl(), process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Drizzle ORM instance backed by pg Pool (server-only, depends on DATABASE_URL). */
export function createDrizzleClient() {
  if (typeof window !== 'undefined') {
    throw new Error('Drizzle client must not be used in browser');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('Missing DATABASE_URL');
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return drizzle(pool, { schema });
}

// Re-export schema map so consumers can do `import { schema } from '@ai-study/core'`
export { schema as dbSchema };
