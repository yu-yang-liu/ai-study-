// Sliding-window rate limiter with Redis + in-memory fallback.
//
// Production: set REDIS_URL to use Redis (multi-instance safe).
// Development / serverless: falls back to in-memory Map.
//
// Redis sliding window uses sorted sets with atomic Lua script.

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimitBackend {
  check(key: string, maxRequests: number, windowMs: number): Promise<RateLimitResult>;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

// ── In-memory backend (fallback) ──

const memoryStore = new Map<string, RateLimitEntry>();

const memoryBackend: RateLimitBackend = {
  async check(key: string, maxRequests: number, windowMs: number) {
    const now = Date.now();
    const cutoff = now - windowMs;

    let entry = memoryStore.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      memoryStore.set(key, entry);
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
  },
};

// ── Redis backend (production, optional) ──

interface RedisLike {
  eval(script: string, numKeys: number, ...args: Array<string | number>): Promise<unknown>;
  quit(): Promise<void>;
}

const REDIS_URL = process.env.REDIS_URL;

let redisClient: RedisLike | null = null;
let redisInitAttempted = false;

async function tryConnectRedis(): Promise<RedisLike | null> {
  if (!REDIS_URL) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Redis } = require('ioredis') as { Redis: new (url: string, opts?: Record<string, unknown>) => RedisLike };
    return new Redis(REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
  } catch {
    return null;
  }
}

// Lua script: atomic sliding window via sorted set
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local maxRequests = tonumber(ARGV[3])

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)

local count = redis.call('ZCARD', key)
if count >= maxRequests then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retryAfter = 0
  if oldest[2] then
    retryAfter = tonumber(oldest[2]) + window - now
  end
  return {0, 0, retryAfter}
end

redis.call('ZADD', key, now, now .. '-' .. math.random())
redis.call('EXPIRE', key, math.ceil(window / 1000) + 1)
return {1, maxRequests - count - 1, 0}
`;

const redisBackend: RateLimitBackend = {
  async check(key, maxRequests, windowMs) {
    if (!redisClient) {
      return memoryBackend.check(key, maxRequests, windowMs);
    }
    try {
      const now = Date.now();
      const rawResult = await redisClient.eval(
        SLIDING_WINDOW_LUA,
        1,
        key,
        now.toString(),
        windowMs.toString(),
        maxRequests.toString(),
      );

      const result = rawResult as number[];
      const allowed = Number(result[0]) === 1;
      const remaining = typeof result[1] === 'number' ? Number(result[1]) : 0;
      const retryAfterMs = typeof result[2] === 'number' && result[2] > 0 ? result[2] : undefined;

      return { allowed, remaining, retryAfterMs };
    } catch {
      return memoryBackend.check(key, maxRequests, windowMs);
    }
  },
};

async function getBackend(): Promise<RateLimitBackend> {
  if (redisClient) return redisBackend;

  if (!redisInitAttempted) {
    redisInitAttempted = true;
    redisClient = await tryConnectRedis();
    if (redisClient) {
      console.log('[rate-limit] Using Redis backend');
    }
  }

  return redisClient ? redisBackend : memoryBackend;
}

// ── Public API ──

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs = 60_000,
): Promise<RateLimitResult> {
  const backend = await getBackend();
  return backend.check(key, maxRequests, windowMs);
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
