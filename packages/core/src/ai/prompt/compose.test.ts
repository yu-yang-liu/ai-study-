import { describe, it, expect } from 'vitest';
import { composePrompt } from './compose';
import { normalizeSubject, getPersona } from './persona';

describe('normalizeSubject', () => {
  it('normalizes english names', () => {
    expect(normalizeSubject('math')).toBe('数学');
    expect(normalizeSubject('english')).toBe('英语');
  });

  it('passes through Chinese names', () => {
    expect(normalizeSubject('语文')).toBe('语文');
  });
});

describe('getPersona', () => {
  it('returns high-school persona', () => {
    const high = getPersona('数学');
    expect(high.role).toContain('高考');
  });
});

describe('composePrompt', () => {
  it('includes persona, task, format, references, and learner layers', () => {
    const result = composePrompt({
      task: 'analyze',
      subject: '数学',
      phase: 'high',
      userInput: '求导数 f(x)=x^2 的极值',
      references: [{ examPoint: '导数应用', analysis: '求导后找驻点', questionType: '计算题', similarity: 0.88 }],
      learnerContext: '该生导数章节掌握较弱',
    });

    expect(result).toContain('高考');
    expect(result).toContain('判断所属学科');
    expect(result).toContain('考点：导数应用');
    expect(result).toContain('评分要点：求导后找驻点');
    expect(result).toContain('学生学情：该生导数章节掌握较弱');
    expect(result).toContain('f(x)=x^2');
  });

  it('works without optional layers', () => {
    const result = composePrompt({
      task: 'chat',
      subject: '英语',
      phase: 'high',
      userInput: 'What is a gerund?',
    });
    expect(result).toContain('高考英语教师');
    expect(result).toContain('gerund');
  });
});
