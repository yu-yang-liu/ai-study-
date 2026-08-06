import { describe, it, expect } from 'vitest';
import { composeEpisodicBlock } from './memory';
import type { EpisodicMemory } from './types';

function ep(id: string, content: string, score: number, source: string): EpisodicMemory {
  return { id, content, score, source };
}

describe('composeEpisodicBlock', () => {
  it('returns empty string for undefined episodic', () => {
    expect(composeEpisodicBlock(undefined)).toBe('');
  });

  it('returns empty string for empty array', () => {
    expect(composeEpisodicBlock([])).toBe('');
  });

  it('formats a single episodic memory', () => {
    const out = composeEpisodicBlock([ep('m1', '批改 80/100：导数失分多', 0.91, 'grade:数学')]);
    expect(out).toBe('【相关历史经历】\n- [grade:数学] 批改 80/100：导数失分多（相似度 0.91）');
  });

  it('formats multiple episodic memories line by line', () => {
    const out = composeEpisodicBlock([
      ep('m1', '计划《冲刺导数》', 0.88, 'plan:数学'),
      ep('m2', '目标院校：清华', 0.82, 'fact'),
    ]);
    expect(out).toBe(
      '【相关历史经历】\n- [plan:数学] 计划《冲刺导数》（相似度 0.88）\n- [fact] 目标院校：清华（相似度 0.82）',
    );
  });

  it('keeps raw score number as-is (no rounding here)', () => {
    const out = composeEpisodicBlock([ep('m1', 'x', 0.876, 'chat_conclusion')]);
    expect(out).toContain('相似度 0.876');
  });
});
