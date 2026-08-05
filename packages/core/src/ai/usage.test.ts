import { describe, it, expect } from 'vitest';

// Duplicated PRICING/cost logic from usage.ts for in-unit testing.
// calcCost must stay in sync with usage.ts.
const PRICING: Record<string, { input: number; output: number }> = {
  'deepseek-chat': { input: 0.001, output: 0.002 },
  'qwen-vl-max': { input: 0.005, output: 0.015 },
  'text-embedding-v3': { input: 0.0004, output: 0 },
};

function calcCost(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICING[model] ?? { input: 0, output: 0 };
  return (inputTokens / 1000) * price.input + (outputTokens / 1000) * price.output;
}

describe('calcCost', () => {
  it('calculates deepseek chat cost correctly', () => {
    expect(calcCost('deepseek-chat', 1000, 500)).toBeCloseTo(0.002, 5);
  });

  it('calculates embedding cost (output=0)', () => {
    expect(calcCost('text-embedding-v3', 10000, 0)).toBeCloseTo(0.004, 5);
  });

  it('returns 0 for unknown model', () => {
    expect(calcCost('unknown-model', 1000, 1000)).toBe(0);
  });

  it('deepseek: 1M tokens �?$3', () => {
    const cost = calcCost('deepseek-chat', 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(3, 0);
  });
});
