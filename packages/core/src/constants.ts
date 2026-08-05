/** Single high-school phase baseline (ai-study monorepo). */
export type AppPhase = 'high';

export const APP_PHASE: AppPhase = 'high';

/** Nine Gaokao subjects — single source of truth for UI, seed data, and prompts. */
export const HIGH_SUBJECTS = [
  '\u8bed\u6587',
  '\u6570\u5b66',
  '\u82f1\u8bed',
  '\u7269\u7406',
  '\u5316\u5b66',
  '\u751f\u7269',
  '\u653f\u6cbb',
  '\u5386\u53f2',
  '\u5730\u7406',
] as const;

export type HighSubject = (typeof HIGH_SUBJECTS)[number];
