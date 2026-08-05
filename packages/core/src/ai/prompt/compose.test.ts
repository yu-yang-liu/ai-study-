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
    expect(result).toContain('\u8003\u70b9\uff1a\u5bfc\u6570\u5e94\u7528');
    expect(result).toContain('\u8bc4\u5206\u8981\u70b9\uff1a\u6c42\u5bfc\u540e\u627e\u9a7b\u70b9');
    expect(result).toContain('\u5b66\u751f\u5b66\u60c5\uff1a\u8be5\u751f\u5bfc\u6570\u7ae0\u8282\u638c\u63e1\u8f83\u5f31');
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
