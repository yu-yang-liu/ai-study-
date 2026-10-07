// Sliding-window rate limiter — single-instance, in-memory implementation.
//
// 注意：计数保存在进程内 Map 中。多实例 / Serverless 部署下各实例互相独立，
// 如需跨实例限流必须自行接入共享存储（Redis 等）。此前代码里的 ioredis 分支
// 依赖未声明、require 必然失败并静默回退内存，属于从未生效的死代码，已移除。

interface RateLimitEntry {
  timestamps: number[];
  // check() 记录命中时保存的窗口长度，供 peekRateLimit 按“当前窗口”过滤。
  windowMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

// 防止限流键无限累积导致内存缓慢增长：超过上限时按插入序淘汰最旧的键。
const MAX_ENTRIES = 5_000;

const memoryStore = new Map<string, RateLimitEntry>();

function evictOldestIfNeeded(): void {
  while (memoryStore.size > MAX_ENTRIES) {
    const oldestKey = memoryStore.keys().next().value;
    if (oldestKey === undefined) break;
    memoryStore.delete(oldestKey);
  }
}

async function check(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const cutoff = now - windowMs;

  let entry = memoryStore.get(key);
  if (!entry) {
    entry = { timestamps: [], windowMs };
    memoryStore.set(key, entry);
    evictOldestIfNeeded();
  } else {
    entry.windowMs = windowMs;
  }

  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= maxRequests) {
    const oldest = entry.timestamps[0]!;
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: oldest + windowMs - now,
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: maxRequests - entry.timestamps.length,
  };
}

// ── Public API ──

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs = 60_000,
): Promise<RateLimitResult> {
  return check(key, maxRequests, windowMs);
}

/** 返回 key 在当前窗口内的命中计数；只读，不记录新命中。 */
export function peekRateLimit(key: string): number {
  const entry = memoryStore.get(key);
  if (!entry) return 0;
  const windowMs = entry.windowMs;
  if (!windowMs) return entry.timestamps.length;
  const cutoff = Date.now() - windowMs;
  return entry.timestamps.filter((t) => t > cutoff).length;
}

/** 删除 key 的限流计数（例如登录成功后清空失败计数）。 */
export function clearRateLimit(key: string): void {
  memoryStore.delete(key);
}

export function rateLimitByKey(
  prefix: string,
  value: string,
  maxRequests: number,
  windowMs = 60_000,
): Promise<RateLimitResult> {
  return checkRateLimit(`${prefix}:${value}`, maxRequests, windowMs);
}

export const AUTH_RATE_LIMIT = { maxRequests: 5, windowMs: 60_000 } as const;
export const AI_RATE_LIMIT = { maxRequests: 20, windowMs: 60_000 } as const;

export function checkAIRateLimit(userId: string): Promise<RateLimitResult> {
  return checkRateLimit(`ai:${userId}`, AI_RATE_LIMIT.maxRequests, AI_RATE_LIMIT.windowMs);
}
