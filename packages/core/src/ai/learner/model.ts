import type { LearnerModel, LearnerPace, LearnerPreferences, ErrorProfile } from './types';
import { DEFAULT_LEARNER_MODEL } from './types';

// ── Forgetting curve ──
const DECAY_HALF_LIFE_DAYS = 14; // mastery halves if unseen for 2 weeks

function applyDecay(level: number, daysSinceLastSeen: number): number {
  if (daysSinceLastSeen <= 0) return level;
  const decayFactor = Math.pow(0.5, daysSinceLastSeen / DECAY_HALF_LIFE_DAYS);
  return Math.max(0, level * decayFactor);
}

function determineTrend(oldLevel: number, newLevel: number): 'up' | 'flat' | 'down' {
  if (newLevel > oldLevel + 0.05) return 'up';
  if (newLevel < oldLevel - 0.05) return 'down';
  return 'flat';
}

function buildErrorProfile(
  errorEvents: Array<{ errorType: string | null }>,
): ErrorProfile[] {
  if (errorEvents.length === 0) return [];

  const errorMap = new Map<string, number>();
  for (const { errorType } of errorEvents) {
    if (!errorType) continue;
    errorMap.set(errorType, (errorMap.get(errorType) ?? 0) + 1);
  }

  const total = errorEvents.length;
  return Array.from(errorMap.entries())
    .map(([type, count]) => ({
      type,
      count,
      recentRate: count / total,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // top 5 error types
}

/**
 * Aggregates a LearnerModel from user_profiles row + knowledge_mastery rows + error events.
 * This is the query-time aggregation; events are recorded separately and
 * recalculated periodically (or on-demand).
 */
export function buildLearnerModel(opts: {
  userProfiles: {
    targetScore?: number;
    weakSubjects: string[];
    strongSubjects: string[];
    abilities: Record<string, number>;
    pace: Record<string, unknown>;
    preferences: Record<string, unknown>;
    dataRichness: number;
  } | null;
  knowledgeMastery: Array<{
    knowledgePoint: string;
    level: number;
    lastSeen: string; // ISO
    trend: string;
  }>;
  errorEvents?: Array<{ errorType: string | null }>;
}): LearnerModel {
  if (!opts.userProfiles) return { ...DEFAULT_LEARNER_MODEL };

  const now = Date.now();

  // Apply forgetting curve to each mastery entry
  const mastery: LearnerModel['mastery'] = {};
  for (const kp of opts.knowledgeMastery) {
    const daysSince = (now - new Date(kp.lastSeen).getTime()) / (1000 * 60 * 60 * 24);
    const decayedLevel = applyDecay(kp.level, daysSince);
    mastery[kp.knowledgePoint] = {
      knowledgePoint: kp.knowledgePoint,
      level: decayedLevel,
      lastSeen: kp.lastSeen,
      trend: determineTrend(kp.level, decayedLevel),
    };
  }

  const abilities = {
    '理解': opts.userProfiles.abilities['理解'] ?? 0.5,
    '表达': opts.userProfiles.abilities['表达'] ?? 0.5,
    '推理': opts.userProfiles.abilities['推理'] ?? 0.5,
    '计算': opts.userProfiles.abilities['计算'] ?? 0.5,
    '应用': opts.userProfiles.abilities['应用'] ?? 0.5,
  };

  const pace: LearnerPace = {
    avgDailyMinutes: (opts.userProfiles.pace.avgDailyMinutes as number) ?? 0,
    activeHours: (opts.userProfiles.pace.activeHours as number[]) ?? [],
    streakDays: (opts.userProfiles.pace.streakDays as number) ?? 0,
  };

  const preferences: LearnerPreferences = {
    explainStyle: (opts.userProfiles.preferences.explainStyle as LearnerPreferences['explainStyle']),
    preferredDifficulty: (opts.userProfiles.preferences.preferredDifficulty as number),
  };

  const errorProfile = buildErrorProfile(opts.errorEvents ?? []);

  return {
    mastery,
    abilities,
    errorProfile,
    weakSubjects: opts.userProfiles.weakSubjects ?? [],
    strongSubjects: opts.userProfiles.strongSubjects ?? [],
    pace,
    preferences,
    targetScore: opts.userProfiles.targetScore,
    dataRichness: opts.userProfiles.dataRichness ?? 0,
  };
}
