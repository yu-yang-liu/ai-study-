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

/** Anon client: safe for server and client. Uses anon key, subject to RLS. */
export function createAnonClient(): SupabaseClient {
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return createClient(getSupabaseUrl(), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Service-role client: SERVER ONLY. Bypasses RLS. For admin/RAG/metering. */
export function createServiceClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('Service role client must not be used in browser');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(getSupabaseUrl(), process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Service-role client 单例。
 * service client 不绑定任何请求级用户/状态（绕 RLS、全局共享），可安全复用，
 * 避免每次调用 createServiceClient() 都新建连接。anon client 受 RLS、按请求隔离，
 * 仍必须每次新建，不在此缓存。
 *
 * 模块级缓存：同一 Node 进程内只建一次。Supabase js 客户端内部自带连接池/复用，
 * 单例化后吞吐更稳定。调用方从 createServiceClient() 切换到 getServiceClient() 即可。
 */
let _serviceClient: SupabaseClient | null = null;
export function getServiceClient(): SupabaseClient {
  if (_serviceClient) return _serviceClient;
  _serviceClient = createServiceClient();
  return _serviceClient;
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
