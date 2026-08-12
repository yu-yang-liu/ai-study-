import { describe, it, expect } from 'vitest';
import {
  masteryDelta,
  clampLevel,
  masteryTrend,
  calculateDataRichness,
  resolveKnowledgePoints,
} from './mastery';

describe('masteryDelta', () => {
  it('returns positive delta for correct answers', () => {
    expect(masteryDelta('correct')).toBeGreaterThan(0);
  });

  it('returns negative delta for incorrect answers', () => {
    expect(masteryDelta('incorrect')).toBeLessThan(0);
  });

  it('maps review quality to increasing deltas', () => {
    expect(masteryDelta('review', 0)).toBeLessThan(masteryDelta('review', 3));
    expect(masteryDelta('review', 3)).toBeLessThan(masteryDelta('review', 5));
  });
});

describe('clampLevel', () => {
  it('clamps to 0–1', () => {
    expect(clampLevel(-0.2)).toBe(0);
    expect(clampLevel(1.5)).toBe(1);
    expect(clampLevel(0.4)).toBe(0.4);
  });
});

describe('masteryTrend', () => {
  it('detects up/down/flat', () => {
    expect(masteryTrend(0.3, 0.5)).toBe('up');
    expect(masteryTrend(0.5, 0.3)).toBe('down');
    expect(masteryTrend(0.5, 0.51)).toBe('flat');
  });
});

describe('resolveKnowledgePoints', () => {
  it('falls back to subject bucket when empty', () => {
    expect(resolveKnowledgePoints([], '数学')).toEqual(['数学·综合练习']);
  });

  it('filters blanks', () => {
    expect(resolveKnowledgePoints(['导数', '  ', '极限'], '数学')).toEqual(['导数', '极限']);
  });
});

describe('calculateDataRichness', () => {
  it('uses coverage instead of counting repeated events as new knowledge', () => {
    expect(calculateDataRichness(1, 100)).toBeLessThan(0.1);
    expect(calculateDataRichness(30, 100)).toBe(1);
    expect(calculateDataRichness(30, 200)).toBe(1);
  });
});
