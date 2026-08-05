import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const planArgsSchema = z.object({
  focus: z.string().optional(),
});

const analyzeArgsSchema = z.object({
  questionContent: z.string().min(10),
});

const gradeArgsSchema = z.object({
  questionContent: z.string().min(10),
  studentAnswer: z.string().min(1),
  questionType: z.enum(['math', 'essay']).default('math'),
});

describe('chat agent tool args', () => {
  it('plan args accept optional focus', () => {
    expect(planArgsSchema.parse({}).focus).toBeUndefined();
    expect(planArgsSchema.parse({ focus: '\u51fd\u6570' }).focus).toBe('\u51fd\u6570');
  });

  it('analyze args require minimum content length', () => {
    expect(analyzeArgsSchema.safeParse({ questionContent: 'short' }).success).toBe(false);
    expect(analyzeArgsSchema.safeParse({ questionContent: '1234567890' }).success).toBe(true);
  });

  it('grade args require question and answer', () => {
    expect(
      gradeArgsSchema.safeParse({
        questionContent: '1234567890',
        studentAnswer: 'x=1',
      }).success,
    ).toBe(true);
    expect(
      gradeArgsSchema.safeParse({
        questionContent: '1234567890',
      }).success,
    ).toBe(false);
  });
});
