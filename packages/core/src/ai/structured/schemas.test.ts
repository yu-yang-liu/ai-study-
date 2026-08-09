import { describe, it, expect } from 'vitest';
import { blockSchema } from './schemas';

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
});
