import { describe, it, expect } from 'vitest';
import { composeUserFactsBlock, normalizeMemoryFact } from './facts';
import type { StoredFact } from './facts';

function fact(
  key: string,
  value: string,
  category?: string,
  updatedAt = '2026-08-06T00:00:00Z',
): StoredFact {
  return { id: `id-${key}`, key, value, category, updatedAt };
}

describe('composeUserFactsBlock', () => {
  it('returns empty string for no facts (M1/M3 compat)', () => {
    expect(composeUserFactsBlock([])).toBe('');
  });

  it('formats a single fact with category tag', () => {
    const out = composeUserFactsBlock([fact('target_school', '清华大学', 'goal')]);
    expect(out).toBe('【跨会话记忆】\n- [goal]target_school：清华大学');
  });

  it('formats a single fact without category', () => {
    const out = composeUserFactsBlock([fact('exam_date', '2026-06-07')]);
    expect(out).toBe('【跨会话记忆】\n- exam_date：2026-06-07');
  });

  it('formats multiple facts line by line', () => {
    const out = composeUserFactsBlock([
      fact('target_school', '清华', 'goal'),
      fact('weak_topic', '导数', 'weak_point'),
    ]);
    expect(out).toBe(
      '【跨会话记忆】\n- [goal]target_school：清华\n- [weak_point]weak_topic：导数',
    );
  });
});

describe('normalizeMemoryFact', () => {
  it('trims and collapses untrusted fact text', () => {
    expect(
      normalizeMemoryFact({
        key: '  target_school ',
        value: '  清华\n大学  ',
        category: ' goal ',
      }),
    ).toEqual({ key: 'target_school', value: '清华 大学', category: 'goal' });
  });

  it('rejects empty facts after normalization', () => {
    expect(() => normalizeMemoryFact({ key: '   ', value: 'x' })).toThrow();
    expect(() => normalizeMemoryFact({ key: 'x', value: '\n\t' })).toThrow();
  });
});
