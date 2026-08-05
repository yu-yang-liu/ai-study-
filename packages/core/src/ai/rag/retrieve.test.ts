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
    { id: 'a', examPoint: '\u5bfc\u6570\u7efc\u5408\u5e94\u7528', analysis: '\u5229\u7528\u5bfc\u6570\u6c42\u6781\u503c', questionType: '\u8ba1\u7b97\u9898', similarity: 0.82 },
    { id: 'b', examPoint: '\u6570\u5217\u6c42\u548c', analysis: '\u7b49\u5dee\u7b49\u6bd4\u516c\u5f0f', questionType: '\u8ba1\u7b97\u9898', similarity: 0.85 },
    { id: 'c', examPoint: '\u5bfc\u6570\u4e0e\u4e0d\u7b49\u5f0f', analysis: '\u6784\u9020\u51fd\u6570\u6cd5', questionType: '\u8bc1\u660e\u9898', similarity: 0.80 },
  ];

  it('boosts exact subject match and sorts by score', () => {
    const ranked = rerank(candidates, '\u5bfc\u6570');
    expect(ranked[0]!.id).toBe('a'); // 0.82 + 0.05 = 0.87 > 0.85
    expect(ranked[1]!.id).toBe('c'); // 0.80 + 0.05 = 0.85
    expect(ranked[2]!.id).toBe('b'); // 0.85 (no boost)
  });

  it('returns top3 unchanged when all match', () => {
    const ranked = rerank(candidates, '\u6570\u5b66');
    // None contains '\u6570\u5b66' explicitly, so no boost
    expect(ranked[0]!.id).toBe('b'); // 0.85
  });
});
