export type MasteryOutcome = 'exposure' | 'correct' | 'incorrect' | 'review';

export interface MasteryStateInput {
  level: number;
  uncertainty?: number;
  evidenceCount?: number;
  lastSeen?: string;
}

export interface MasteryEvidence {
  outcome: MasteryOutcome;
  quality?: number;
  difficulty?: number;
  confidence?: number;
  observedAt?: string;
}

export interface MasteryState {
  level: number;
  uncertainty: number;
  evidenceCount: number;
  trend: 'up' | 'flat' | 'down';
}

const DEFAULT_UNCERTAINTY = 1;
const FORGETTING_HALF_LIFE_DAYS = 30;

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function safeNumber(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? (value as number) : fallback;
}

function daysBetween(from: string | undefined, to: string): number {
  if (!from) return 0;
  const days = (new Date(to).getTime() - new Date(from).getTime()) / (24 * 60 * 60 * 1000);
  return Number.isFinite(days) ? Math.max(0, days) : 0;
}

function outcomeSignal(evidence: MasteryEvidence, currentLevel: number): number {
  switch (evidence.outcome) {
    case 'correct':
      return 1;
    case 'incorrect':
      return 0;
    case 'review':
      return clamp(safeNumber(evidence.quality, 0) / 5);
    case 'exposure':
      // Seeing a concept is weak evidence; it should not masquerade as mastery.
      return currentLevel;
  }
}

function evidenceWeight(evidence: MasteryEvidence): number {
  const base = evidence.outcome === 'exposure' ? 0.1 : 1;
  const difficulty = 0.75 + 0.75 * clamp(safeNumber(evidence.difficulty, 0.5));
  const confidence = 0.5 + 0.5 * clamp(safeNumber(evidence.confidence, 0.8));
  return base * difficulty * confidence;
}

function trend(oldLevel: number, newLevel: number): 'up' | 'flat' | 'down' {
  if (newLevel > oldLevel + 0.03) return 'up';
  if (newLevel < oldLevel - 0.03) return 'down';
  return 'flat';
}

/**
 * Evidence-weighted mastery update.
 *
 * The level is the current estimate; uncertainty expresses how much evidence
 * supports it. Forgetting reduces confidence and pulls the estimate toward
 * 0.5 instead of collapsing every unseen topic toward zero.
 */
export function updateMasteryState(
  current: MasteryStateInput,
  evidence: MasteryEvidence,
  now = new Date().toISOString(),
): MasteryState {
  const oldLevel = clamp(safeNumber(current.level, 0.5));
  const oldUncertainty = clamp(safeNumber(current.uncertainty, DEFAULT_UNCERTAINTY));
  const oldEvidenceCount = Math.max(0, Math.floor(safeNumber(current.evidenceCount, 0)));
  const retention = Math.pow(0.5, daysBetween(current.lastSeen, now) / FORGETTING_HALF_LIFE_DAYS);

  const decayedLevel = 0.5 + (oldLevel - 0.5) * retention;
  const evidencePrecision = Math.max(1, 1 + oldEvidenceCount);
  const uncertaintyPrecision = 1 / Math.max(0.1, oldUncertainty) ** 2;
  const priorPrecision = Math.max(
    1,
    Math.min(100, Math.max(evidencePrecision, uncertaintyPrecision) * retention),
  );
  const priorAlpha = decayedLevel * priorPrecision;
  const priorBeta = (1 - decayedLevel) * priorPrecision;

  const weight = evidenceWeight(evidence);
  const signal = outcomeSignal(evidence, decayedLevel);
  const alpha = priorAlpha + signal * weight;
  const beta = priorBeta + (1 - signal) * weight;
  const precision = alpha + beta;
  const nextLevel = clamp(alpha / precision);
  const nextUncertainty = clamp(1 / Math.sqrt(precision));

  return {
    level: nextLevel,
    uncertainty: nextUncertainty,
    evidenceCount: oldEvidenceCount + 1,
    trend: trend(oldLevel, nextLevel),
  };
}
