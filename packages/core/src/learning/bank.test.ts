import { describe, expect, it } from 'vitest';
import { bankAnswersMatch, normalizeBankAnswer } from './bank';

describe('question bank answer matching', () => {
  it('normalizes punctuation and answer labels', () => {
    expect(normalizeBankAnswer('答案： A。')).toBe('a');
    expect(normalizeBankAnswer(' x² - 4x + 3 ')).toBe('x2-4x+3');
  });

  it('accepts alternative answers separated by slash or 或', () => {
    expect(bankAnswersMatch('which/that', 'that')).toBe(true);
    expect(bankAnswersMatch('A 或 B', 'b')).toBe(true);
    expect(bankAnswersMatch('A', 'A. which')).toBe(true);
    expect(bankAnswersMatch('A,C', 'C、A')).toBe(true);
  });

  it('does not accept unrelated answers', () => {
    expect(bankAnswersMatch('which/that', 'who')).toBe(false);
    expect(bankAnswersMatch('0', '1')).toBe(false);
  });
});
