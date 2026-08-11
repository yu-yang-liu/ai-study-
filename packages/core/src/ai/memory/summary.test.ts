import { describe, it, expect } from 'vitest';
import {
  shouldSummarize,
  composeSummaryBlock,
  splitWindow,
  boundSummaryInput,
  RAW_WINDOW,
  SUMMARY_TRIGGER,
} from './summary';
import type { ConversationMessage } from '../../learning/conversation';

function msg(role: 'user' | 'assistant', content: string, at: string): ConversationMessage {
  return { role, content, createdAt: at };
}

describe('shouldSummarize', () => {
  it('does not trigger at or below threshold', () => {
    expect(shouldSummarize(0)).toBe(false);
    expect(shouldSummarize(SUMMARY_TRIGGER)).toBe(false);
  });

  it('triggers above threshold', () => {
    expect(shouldSummarize(SUMMARY_TRIGGER + 1)).toBe(true);
    expect(shouldSummarize(50)).toBe(true);
  });

  it('respects custom trigger', () => {
    expect(shouldSummarize(6, 5)).toBe(true);
    expect(shouldSummarize(5, 5)).toBe(false);
  });
});

describe('composeSummaryBlock', () => {
  it('returns longTerm verbatim when no summary (M1 compat)', () => {
    expect(composeSummaryBlock(null, '【学生画像】目标 120。')).toBe('【学生画像】目标 120。');
    expect(composeSummaryBlock(undefined, '')).toBe('');
  });

  it('prepends summary block when summary present', () => {
    const out = composeSummaryBlock('用户目标 985', '【学生画像】薄弱：导数');
    expect(out).toBe('【历史摘要】\n用户目标 985\n\n【学生画像】薄弱：导数');
  });
});

describe('splitWindow', () => {
  it('returns all recent and empty older when under window', () => {
    const msgs = [msg('user', 'q1', 't1'), msg('assistant', 'a1', 't2')];
    const { recent, older } = splitWindow(msgs, RAW_WINDOW);
    expect(recent).toEqual(msgs);
    expect(older).toEqual([]);
  });

  it('splits recent (last N) from older when exceeding window', () => {
    const msgs: ConversationMessage[] = [];
    for (let i = 0; i < 25; i++) {
      msgs.push(msg(i % 2 === 0 ? 'user' : 'assistant', `m${i}`, `t${i}`));
    }
    const { recent, older } = splitWindow(msgs, RAW_WINDOW);
    expect(recent.length).toBe(RAW_WINDOW); // last 20
    expect(older.length).toBe(5); // first 5
    expect(older[0]!.content).toBe('m0');
    expect(recent[recent.length - 1]!.content).toBe('m24');
  });

  it('handles empty messages', () => {
    const { recent, older } = splitWindow([], RAW_WINDOW);
    expect(recent).toEqual([]);
    expect(older).toEqual([]);
  });
});

describe('boundSummaryInput', () => {
  it('keeps both the oldest and newest lines within the budget', () => {
    const out = boundSummaryInput(['old '.repeat(20), 'middle '.repeat(20), 'new '.repeat(20)], 80, '...');
    expect(out[0]).toContain('old');
    expect(out.at(-1)).toContain('new');
    expect(out).toContain('...');
    expect(out.join('\n').length).toBeLessThanOrEqual(80);
  });
});
