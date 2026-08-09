import { describe, it, expect } from 'vitest';
import { blocksToPlainText } from './blocks';
import type { Block } from './schemas';

describe('blocksToPlainText', () => {
  it('returns empty string for undefined / null / empty', () => {
    expect(blocksToPlainText(undefined)).toBe('');
    expect(blocksToPlainText(null)).toBe('');
    expect(blocksToPlainText([])).toBe('');
  });

  it('joins text blocks by content', () => {
    const blocks: Block[] = [
      { type: 'text', content: '设函数' },
      { type: 'text', content: 'f(x)=x^2' },
    ];
    expect(blocksToPlainText(blocks)).toBe('设函数 f(x)=x^2');
  });

  it('renders formula blocks as latex source (no $ delimiters)', () => {
    const blocks: Block[] = [
      { type: 'text', content: '解得' },
      { type: 'formula', latex: '\\frac{1}{2}' },
    ];
    expect(blocksToPlainText(blocks)).toBe('解得 \\frac{1}{2}');
  });

  it('formula falls back to content when latex missing (ocr legacy)', () => {
    const blocks = [{ type: 'formula', content: 'x^2+1' }] as unknown as Block[];
    expect(blocksToPlainText(blocks)).toBe('x^2+1');
  });

  it('image block prefers alt, then url, then [图]', () => {
    expect(blocksToPlainText([{ type: 'image', url: 'u1', alt: '示意图' }])).toBe('示意图');
    expect(blocksToPlainText([{ type: 'image', url: 'u1' }])).toBe('u1');
    expect(blocksToPlainText([{ type: 'image' } as unknown as Block])).toBe('[图]');
  });

  it('table block flattens headers + rows', () => {
    const blocks: Block[] = [
      {
        type: 'table',
        headers: ['公式', '值'],
        rows: [
          ['x^2', '4'],
          ['\\sqrt{2}', '1.41'],
        ],
      },
    ];
    expect(blocksToPlainText(blocks)).toBe('公式 | 值\nx^2 | 4\n\\sqrt{2} | 1.41');
  });

  it('steps block flattens title + blocks + tag', () => {
    const blocks: Block[] = [
      {
        type: 'steps',
        title: '配方法',
        steps: [
          {
            title: '第一步',
            blocks: [{ type: 'text', content: '移项' }],
            tag: '配方',
          },
          {
            blocks: [{ type: 'formula', latex: 'x^2=4' }],
          },
        ],
      },
    ];
    expect(blocksToPlainText(blocks)).toBe('第一步：移项（配方）；x^2=4');
  });

  it('visual block renders placeholder text', () => {
    const blocks: Block[] = [{ type: 'visual', kind: 'placeholder' }];
    expect(blocksToPlainText(blocks)).toBe('[示意图]');
  });

  it('mixes multiple block types in order', () => {
    const blocks: Block[] = [
      { type: 'text', content: '由' },
      { type: 'formula', latex: 'a^2+b^2=c^2' },
      { type: 'text', content: '可知斜边' },
      { type: 'image', url: 'fig.png', alt: '直角三角形' },
    ];
    expect(blocksToPlainText(blocks)).toBe('由 a^2+b^2=c^2 可知斜边 直角三角形');
  });

  it('trims leading/trailing whitespace from the join', () => {
    const blocks: Block[] = [
      { type: 'text', content: '  hello  ' },
      { type: 'text', content: 'world' },
    ];
    expect(blocksToPlainText(blocks)).toBe('hello   world');
  });
});
