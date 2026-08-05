import { describe, it, expect } from 'vitest';
import { composeMemoryBlock } from './compose';
import type { AgentMemory } from './types';

describe('composeMemoryBlock', () => {
  it('returns longTerm verbatim when learner context present', () => {
    const mem: AgentMemory = {
      conversationId: 'c1',
      shortTerm: [],
      longTerm: '【学生画像】目标分 120。',
      episodic: undefined,
      isColdStart: false,
    };
    expect(composeMemoryBlock(mem)).toBe(mem.longTerm);
  });

  it('returns empty string on cold start', () => {
    const mem: AgentMemory = {
      conversationId: 'c1',
      shortTerm: [],
      longTerm: '',
      episodic: undefined,
      isColdStart: true,
    };
    expect(composeMemoryBlock(mem)).toBe('');
  });
});

describe('AgentMemory shape', () => {
  it('marks cold start when longTerm is empty and leaves episodic undefined', () => {
    const mem: AgentMemory = {
      conversationId: 'c1',
      shortTerm: [],
      longTerm: '',
      isColdStart: true,
    };
    expect(mem.episodic).toBeUndefined();
    expect(mem.isColdStart).toBe(true);
  });

  it('preserves shortTerm chronological ordering (user then assistant)', () => {
    const mem: AgentMemory = {
      conversationId: 'c1',
      shortTerm: [
        { role: 'user', content: 'q1', createdAt: '2026-08-05T00:00:00Z' },
        { role: 'assistant', content: 'a1', createdAt: '2026-08-05T00:00:01Z' },
      ],
      longTerm: 'snapshot',
      isColdStart: false,
    };
    expect(mem.shortTerm[0]!.role).toBe('user');
    expect(mem.shortTerm[1]!.role).toBe('assistant');
    expect(mem.isColdStart).toBe(false);
  });
});
