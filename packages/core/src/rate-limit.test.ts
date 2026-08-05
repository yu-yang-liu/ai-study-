import { describe, it, expect } from 'vitest';
import { checkRateLimit } from './rate-limit';

describe('checkRateLimit', () => {
  it('allows requests up to max then blocks', async () => {
    const key = `test_${Date.now()}_1`;
    for (let i = 0; i < 5; i++) {
      expect((await checkRateLimit(key, 5, 60_000)).allowed).toBe(true);
    }
    const blocked = await checkRateLimit(key, 5, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('allows concurrently when under limit', async () => {
    const key = `test_${Date.now()}_2`;
    const results = await Promise.all(
      Array.from({ length: 3 }, () => checkRateLimit(key, 10, 60_000)),
    );
    expect(results.every((r) => r.allowed)).toBe(true);
  });

  it('prunes expired entries', async () => {
    const key = `test_${Date.now()}_3`;
    const shortWindow = 50;
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(key, 5, shortWindow);
    }
    await new Promise((r) => setTimeout(r, 60));
    expect((await checkRateLimit(key, 5, shortWindow)).allowed).toBe(true);
  });
});
