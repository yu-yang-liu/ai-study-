/** Single high-school phase baseline (ai-study monorepo). */
export type AppPhase = 'high';

export const APP_PHASE: AppPhase = 'high';

/** Nine Gaokao subjects — single source of truth for UI, seed data, and prompts. */
export const HIGH_SUBJECTS = [
  '语文',
  '数学',
  '英语',
  '物理',
  '化学',
  '生物',
  '政治',
  '历史',
  '地理',
] as const;

export type HighSubject = (typeof HIGH_SUBJECTS)[number];
