import { createServiceClient } from '../db';
import { APP_PHASE } from '../constants';

export type MasteryOutcome = 'exposure' | 'correct' | 'incorrect' | 'review';

/** Per-event mastery delta (level is 0–1). */
export function masteryDelta(outcome: MasteryOutcome, quality?: number): number {
  switch (outcome) {
    case 'exposure':
      return 0.05;
    case 'correct':
      return 0.12;
    case 'incorrect':
      return -0.08;
    case 'review':
      if (quality == null) return 0;
      if (quality <= 1) return -0.15;
      if (quality <= 2) return -0.05;
      if (quality <= 3) return 0.05;
      if (quality <= 4) return 0.1;
      return 0.2;
  }
}

export function clampLevel(level: number): number {
  return Math.min(1, Math.max(0, level));
}

export function masteryTrend(oldLevel: number, newLevel: number): 'up' | 'flat' | 'down' {
  if (newLevel > oldLevel + 0.03) return 'up';
  if (newLevel < oldLevel - 0.03) return 'down';
  return 'flat';
}

/** Normalize knowledge point list; falls back to one subject-level bucket when empty. */
export function resolveKnowledgePoints(knowledgePoints: string[], subject: string): string[] {
  const points = knowledgePoints.map((p) => p.trim()).filter(Boolean);
  if (points.length > 0) return points;
  return [`${subject}·综合练习`];
}

/**
 * Upsert knowledge_mastery rows and bump user_profiles.data_richness.
 * Safe to call with empty points after resolveKnowledgePoints.
 */
export async function updateKnowledgeMastery(
  userId: string,
  subject: string,
  knowledgePoints: string[],
  outcome: MasteryOutcome,
  quality?: number,
): Promise<void> {
  const points = resolveKnowledgePoints(knowledgePoints, subject);
  const delta = masteryDelta(outcome, quality);
  if (delta === 0 && outcome === 'review') return;

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  for (const kp of points) {
    const { data: existing } = await supabase
      .from('knowledge_mastery')
      .select('level')
      .eq('user_id', userId)
      .eq('phase', APP_PHASE)
      .eq('knowledge_point', kp)
      .maybeSingle();

    const oldLevel = Number(existing?.level ?? 0);
    const newLevel = clampLevel(oldLevel + delta);

    await supabase.from('knowledge_mastery').upsert(
      {
        user_id: userId,
        phase: APP_PHASE,
        knowledge_point: kp,
        subject,
        level: newLevel,
        last_seen: now,
        trend: masteryTrend(oldLevel, newLevel),
        updated_at: now,
      },
      { onConflict: 'user_id,phase,knowledge_point' },
    );
  }

  await bumpDataRichness(userId);
}

async function bumpDataRichness(userId: string): Promise<void> {
  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('data_richness')
    .eq('user_id', userId)
    .maybeSingle();

  const current = Number(profile?.data_richness ?? 0);
  const next = Math.min(1, Number((current + 0.02).toFixed(3)));

  await supabase
    .from('user_profiles')
    .update({ data_richness: next, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
}
