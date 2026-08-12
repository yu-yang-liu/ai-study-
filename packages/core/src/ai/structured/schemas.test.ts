import { describe, it, expect } from 'vitest';
import { blockSchema, geometryAstSchema, gradeMathOutput, molecularBlockSchema } from './schemas';

describe('blockSchema (Phase 1 判别联合)', () => {
  it('accepts all six block types', () => {
    const blocks = [
      { type: 'text', content: '解析' },
      { type: 'formula', latex: 'x^2' },
      { type: 'image', url: 'fig.png', alt: '示意图' },
      { type: 'table', headers: ['a'], rows: [['1']] },
      {
        type: 'steps',
        title: '解法',
        steps: [{ title: '第一步', blocks: [{ type: 'text', content: '移项' }] }],
        interaction: { collapsible: true },
      },
      { type: 'visual', kind: 'placeholder' },
    ];
    for (const block of blocks) {
      expect(blockSchema.safeParse(block).success, JSON.stringify(block)).toBe(true);
    }
  });

  it('rejects formula without latex (strict, no ocr-style content)', () => {
    const result = blockSchema.safeParse({ type: 'formula', content: 'x^2' });
    expect(result.success).toBe(false);
  });

  it('rejects text without content', () => {
    expect(blockSchema.safeParse({ type: 'text' }).success).toBe(false);
  });

  it('rejects unknown block type', () => {
    expect(blockSchema.safeParse({ type: 'video', url: 'x' }).success).toBe(false);
  });

  it('rejects table with empty rows', () => {
    expect(blockSchema.safeParse({ type: 'table', rows: [] }).success).toBe(false);
  });

  it('rejects steps without steps array', () => {
    expect(blockSchema.safeParse({ type: 'steps', title: 'x' }).success).toBe(false);
  });

  it('defaults visual.kind to placeholder', () => {
    const parsed = blockSchema.parse({ type: 'visual' });
    expect(parsed).toMatchObject({ type: 'visual', kind: 'placeholder' });
  });

  it('accepts nested steps blocks (recursive)', () => {
    const result = blockSchema.safeParse({
      type: 'steps',
      steps: [
        {
          blocks: [
            {
              type: 'steps',
              steps: [{ blocks: [{ type: 'formula', latex: 'x' }] }],
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts molecular blocks and rejects dangling bond references', () => {
    const molecular = {
      type: 'molecular',
      title: '乙醇结构',
      atoms: [
        { id: 'c1', symbol: 'C', x: 0, y: 0 },
        { id: 'c2', symbol: 'C', x: 2, y: 0 },
        { id: 'o1', symbol: 'O', x: 4, y: 0 },
      ],
      bonds: [
        { from: 'c1', to: 'c2', order: 1 },
        { from: 'c2', to: 'o1', order: 1 },
      ],
    };

    expect(molecularBlockSchema.safeParse(molecular).success).toBe(true);
    expect(blockSchema.safeParse(molecular).success).toBe(true);
    expect(
      molecularBlockSchema.safeParse({
        ...molecular,
        bonds: [{ from: 'c1', to: 'missing', order: 1 }],
      }).success,
    ).toBe(false);
  });

  it('accepts the geometry solid, conic, and relation extensions', () => {
    const result = geometryAstSchema.safeParse({
      type: 'scene',
      elements: [
        {
          type: 'conic',
          kind: 'ellipse',
          center: [0, 0],
          a: 4,
          b: 2,
        },
        {
          type: 'box',
          vertices: [
            [0, 0],
            [2, 0],
            [2, 2],
            [0, 2],
            [0.5, 0.5],
            [2.5, 0.5],
            [2.5, 2.5],
            [0.5, 2.5],
          ],
          faces: [
            [0, 1, 2, 3],
            [4, 5, 6, 7],
          ],
        },
        {
          type: 'cylinder',
          base: [5, 0],
          radius: 1,
          height: 3,
          direction: [0, 1],
        },
        {
          type: 'cone',
          base: [8, 0],
          radius: 1,
          height: 3,
          direction: [0, 1],
        },
        {
          type: 'relation',
          from: [0, 0],
          to: [2, 2],
          relation: 'perpendicular',
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});

describe('gradeMathOutput learning evidence', () => {
  it('accepts structured learning evidence and defaults knowledgePoints', () => {
    const result = gradeMathOutput.parse({
      score: 70,
      maxScore: 100,
      isCorrect: false,
      difficulty: 7,
      errorType: '计算失误',
      abilityAssessment: { 理解: '强', 计算: '弱' },
      steps: [],
    });
    expect(result.knowledgePoints).toEqual([]);
    expect(result.errorType).toBe('计算失误');
  });
});
