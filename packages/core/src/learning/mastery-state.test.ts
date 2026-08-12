import { describe, expect, it } from 'vitest';
import { updateMasteryState } from './mastery-state';

describe('evidence-weighted mastery state', () => {
  it('increases mastery while reducing uncertainty after verified evidence', () => {
    const next = updateMasteryState(
      { level: 0.5, uncertainty: 1, evidenceCount: 0 },
      { outcome: 'correct', difficulty: 0.5, confidence: 1 },
      '2026-08-13T00:00:00.000Z',
    );
    expect(next.level).toBeGreaterThan(0.5);
    expect(next.uncertainty).toBeLessThan(1);
    expect(next.evidenceCount).toBe(1);
  });

  it('lets a difficult correct answer carry more evidence than an easy one', () => {
    const easy = updateMasteryState(
      { level: 0.5, uncertainty: 1, evidenceCount: 0 },
      { outcome: 'correct', difficulty: 0, confidence: 1 },
    );
    const hard = updateMasteryState(
      { level: 0.5, uncertainty: 1, evidenceCount: 0 },
      { outcome: 'correct', difficulty: 1, confidence: 1 },
    );
    expect(hard.level).toBeGreaterThan(easy.level);
    expect(hard.uncertainty).toBeLessThan(easy.uncertainty);
  });

  it('raises uncertainty with time while retaining partial mastery', () => {
    const next = updateMasteryState(
      { level: 0.9, uncertainty: 0.2, evidenceCount: 10, lastSeen: '2026-07-01T00:00:00.000Z' },
      { outcome: 'exposure', observedAt: '2026-08-13T00:00:00.000Z' },
      '2026-08-13T00:00:00.000Z',
    );
    expect(next.level).toBeGreaterThan(0.5);
    expect(next.level).toBeLessThan(0.9);
    expect(next.uncertainty).toBeGreaterThan(0.2);
  });
});
