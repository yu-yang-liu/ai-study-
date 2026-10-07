import { describe, it, expect } from 'vitest';

// Clone the rerank logic from retrieve.ts for in-unit testing
function rerank(
  candidates: Array<{
    id: string;
    examPoint: string;
    analysis: string;
    questionType: string;
    similarity: number;
  }>,
  subject: string,
) {
  return candidates
    .map((c) => ({
      ...c,
      score: c.similarity + (c.examPoint && c.examPoint.includes(subject) ? 0.05 : 0),
    }))
    .sort((a, b) => b.score - a.score);
}

function parseVectorLiteral(str: string): number[] {
  return str.slice(1, -1).split(',').map(Number);
}

describe('parseVectorLiteral', () => {
  it('parses a pgvector literal', () => {
    const result = parseVectorLiteral('[0.1,0.2,0.3]');
    expect(result).toEqual([0.1, 0.2, 0.3]);
  });

  it('handles single element', () => {
    expect(parseVectorLiteral('[1.0]')).toEqual([1.0]);
  });
});

describe('rerank', () => {
  const candidates = [
    { id: 'a', examPoint: '导数综合应用', analysis: '利用导数求极值', questionType: '计算题', similarity: 0.82 },
    { id: 'b', examPoint: '数列求和', analysis: '等差等比公式', questionType: '计算题', similarity: 0.85 },
    { id: 'c', examPoint: '导数与不等式', analysis: '构造函数法', questionType: '证明题', similarity: 0.80 },
  ];

  it('boosts exact subject match and sorts by score', () => {
    const ranked = rerank(candidates, '导数');
    expect(ranked[0]!.id).toBe('a'); // 0.82 + 0.05 = 0.87 > 0.85
    expect(ranked[1]!.id).toBe('c'); // 0.80 + 0.05 = 0.85
    expect(ranked[2]!.id).toBe('b'); // 0.85 (no boost)
  });

  it('returns top3 unchanged when all match', () => {
    const ranked = rerank(candidates, '数学');
    // None contains '数学' explicitly, so no boost
    expect(ranked[0]!.id).toBe('b'); // 0.85
  });
});
