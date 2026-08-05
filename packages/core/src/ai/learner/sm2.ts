/** SM-2 spaced repetition algorithm for wrong question review scheduling. */
export interface SM2State {
  easeFactor: number; // >= 1.3
  intervalDays: number;
  reviewCount: number;
}

/**
 * Update SM-2 state after a review.
 * @param quality - 0-5 subjective rating (0=complete failure, 5=perfect)
 */
export function sm2Update(state: SM2State, quality: number): SM2State {
  let { easeFactor, intervalDays, reviewCount } = state;

  if (quality >= 3) {
    reviewCount++;
    if (reviewCount === 1) {
      intervalDays = 1;
    } else if (reviewCount === 2) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
  } else {
    reviewCount = 0;
    intervalDays = 1;
  }

  easeFactor += 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  if (easeFactor < 1.3) easeFactor = 1.3;

  return { easeFactor, intervalDays, reviewCount };
}

export function sm2Defaults(): SM2State {
  return { easeFactor: 2.5, intervalDays: 1, reviewCount: 0 };
}
