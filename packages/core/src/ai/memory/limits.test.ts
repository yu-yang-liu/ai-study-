import { describe, expect, it } from 'vitest';
import {
  EPISODIC_MEMORY_MAX_RETRIEVAL,
  MEMORY_FACT_KEY_MAX_CHARS,
  clampMemoryLimit,
  clampMemoryScore,
  compactMemoryText,
} from './limits';

describe('memory limits', () => {
  it('compacts control characters and whitespace before truncating', () => {
    expect(compactMemoryText('  a\n\tb\u0000  c  ', 20)).toBe('a b c');
  });

  it('clamps retrieval inputs to safe ranges', () => {
    expect(clampMemoryLimit(999)).toBe(EPISODIC_MEMORY_MAX_RETRIEVAL);
    expect(clampMemoryLimit(0)).toBe(1);
    expect(clampMemoryScore(-1)).toBe(0);
    expect(clampMemoryScore(2)).toBe(1);
  });

  it('keeps fact keys within the database contract', () => {
    expect(compactMemoryText('x'.repeat(100), MEMORY_FACT_KEY_MAX_CHARS)).toHaveLength(
      MEMORY_FACT_KEY_MAX_CHARS,
    );
  });
});
