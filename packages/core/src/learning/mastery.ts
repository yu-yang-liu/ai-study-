import { getServiceClient } from '../db';
import { APP_PHASE } from '../constants';
import { updateMasteryState } from './mastery-state';
import type { MasteryOutcome } from './mastery-state';

export type { MasteryOutcome } from './mastery-state';

/** Legacy delta helper kept for compatibility with existing callers. */
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
 * Data richness is a coverage signal, not a raw event counter. Repeating one
 * knowledge point should not make a learner profile look fully calibrated.
 */
export function calculateDataRichness(masteryPointCount: number, eventCount: number): number {
  const masteryCoverage = Math.min(1, Math.max(0, masteryPointCount) / 30);
  const eventCoverage = Math.min(1, Math.max(0, eventCount) / 100);
  return Number((0.7 * masteryCoverage + 0.3 * masteryCoverage * eventCoverage).toFixed(3));
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
  evidenceOptions?: { difficulty?: number; confidence?: number },
): Promise<void> {
  const points = resolveKnowledgePoints(knowledgePoints, subject);
  const delta = masteryDelta(outcome, quality);
  if (delta === 0 && outcome === 'review') return;

  const supabase = getServiceClient();
  const now = new Date().toISOString();

  for (const kp of points) {
    const { data: existing } = await supabase
      .from('knowledge_mastery')
      .select('level, uncertainty, evidence_count, last_seen')
      .eq('user_id', userId)
      .eq('phase', APP_PHASE)
      .eq('knowledge_point', kp)
      .maybeSingle();

    const oldLevel = Number(existing?.level ?? 0.5);
    const next = updateMasteryState(
      {
        level: oldLevel,
        uncertainty: Number(existing?.uncertainty ?? 1),
        evidenceCount: Number(existing?.evidence_count ?? 0),
        lastSeen: existing?.last_seen ?? undefined,
      },
      {
        outcome,
        quality,
        difficulty:
          evidenceOptions?.difficulty === undefined
            ? undefined
            : evidenceOptions.difficulty > 1
              ? (evidenceOptions.difficulty - 1) / 9
              : evidenceOptions.difficulty,
        confidence: evidenceOptions?.confidence,
      },
      now,
    );

    await supabase.from('knowledge_mastery').upsert(
      {
        user_id: userId,
        phase: APP_PHASE,
        knowledge_point: kp,
        subject,
        level: next.level,
        uncertainty: next.uncertainty,
        evidence_count: next.evidenceCount,
        mastery_version: 'evidence-v1',
        last_seen: now,
        trend: next.trend,
        updated_at: now,
      },
      { onConflict: 'user_id,phase,knowledge_point' },
    );
  }

  await bumpDataRichness(userId);
}

async function bumpDataRichness(userId: string): Promise<void> {
  const supabase = getServiceClient();
  const [{ data: profile }, { count: masteryPointCount }, { count: eventCount }] =
    await Promise.all([
      supabase.from('user_profiles').select('data_richness').eq('user_id', userId).maybeSingle(),
      supabase
        .from('knowledge_mastery')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('phase', APP_PHASE),
      supabase
        .from('learning_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('phase', APP_PHASE),
    ]);

  const current = Number(profile?.data_richness ?? 0);
  const calculated = calculateDataRichness(masteryPointCount ?? 0, eventCount ?? 0);
  const next = Math.max(current, calculated);

  await supabase
    .from('user_profiles')
    .update({ data_richness: next, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
}
