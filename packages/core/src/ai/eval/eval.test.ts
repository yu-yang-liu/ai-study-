import { describe, it, expect } from 'vitest';
import { computeDimensions } from './scoring';

describe('computeDimensions', () => {
  it('scores exact number within tolerance', () => {
    const dims = computeDimensions(
      { score: 100, maxScore: 100 },
      { score: 100 },
      { score: 5 },
    );
    expect(dims[0]!.score).toBe(1);
  });

  it('scores slightly off number as partial', () => {
    const dims = computeDimensions(
      { score: 40 },
      { score: 100 },
      { score: 50 },
    );
    expect(dims[0]!.score).toBeGreaterThan(0.1);
    expect(dims[0]!.score).toBeLessThan(1);
  });

  it('scores boolean match', () => {
    const dims = computeDimensions(
      { isCorrect: true },
      { isCorrect: true },
    );
    expect(dims[0]!.score).toBe(1);
  });

  it('scores boolean mismatch', () => {
    const dims = computeDimensions(
      { isCorrect: false },
      { isCorrect: true },
    );
    expect(dims[0]!.score).toBe(0);
  });

  it('scores array overlap', () => {
    const dims = computeDimensions(
      { strengths: ['内容充实', '结构清晰', '语言流畅'] },
      { strengths: ['内容充实', '语言流畅'] },
    );
    expect(dims[0]!.score).toBe(1);
  });

  it('scores partial array overlap', () => {
    const dims = computeDimensions(
      { strengths: ['内容充实'] },
      { strengths: ['内容充实', '语言流畅', '结构清晰'] },
    );
    expect(dims[0]!.score).toBeCloseTo(1 / 3, 2);
  });

  it('scores object dimension key match', () => {
    const dims = computeDimensions(
      { dimensions: { content: 45, structure: 40, language: 35 } },
      { dimensions: { content: 50, structure: 50, language: 50 } },
    );
    expect(dims[0]!.score).toBe(1);
  });

  it('scores partial object dimension key mismatch', () => {
    const dims = computeDimensions(
      { dimensions: { content: 45 } },
      { dimensions: { content: 50, structure: 50, language: 50 } },
    );
    expect(dims[0]!.score).toBeCloseTo(1 / 3, 2);
  });

  it('returns formatCompliance for empty expected', () => {
    const dims = computeDimensions(
      { text: 'hello' },
      {},
    );
    expect(dims[0]!.name).toBe('formatCompliance');
    expect(dims[0]!.score).toBe(1);
  });

  it('scores string content fuzzy match', () => {
    const dims = computeDimensions(
      { summary: '本题考察了三角函数的基础知识' },
      { summary: '三角函数' },
    );
    expect(dims[0]!.score).toBe(1);
  });

  it('handles null actual', () => {
    const dims = computeDimensions(null, { score: 100 }, { score: 10 });
    expect(dims[0]!.score).toBe(0);
  });

  it('multiple dimensions weight equally', () => {
    const dims = computeDimensions(
      { score: 90, isCorrect: true },
      { score: 100, isCorrect: true },
      { score: 20 },
    );
    expect(dims.length).toBe(2);
    expect(dims[0]!.weight).toBe(0.5);
    expect(dims[1]!.weight).toBe(0.5);
  });
});
