import { createServiceClient } from '../../db';
import { createClientFromToken } from '../../auth';
import type { LearnerModel } from './types';
import { buildLearnerModel } from './model';

/**
 * Fetches the learner context for a given user, generating a text summary
 * for injection into AI prompts. Uses pre-aggregated user_profiles +
 * knowledge_mastery + recent error events. Returns empty string on cold start (dataRichness=0).
 */
export async function getLearnerContext(
  userId: string,
  accessToken?: string,
): Promise<{ model: LearnerModel; context: string }> {
  const supabase = accessToken ? createClientFromToken(accessToken) : createServiceClient();

  // Query user_profiles
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  // Query knowledge_mastery
  const { data: masteryRows } = await supabase
    .from('knowledge_mastery')
    .select('knowledge_point, level, last_seen, trend')
    .eq('user_id', userId);

  // Query recent error events (last 90 days) for errorProfile aggregation
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: errorEventsRaw } = await supabase
    .from('learning_events')
    .select('error_type')
    .eq('user_id', userId)
    .not('error_type', 'is', null)
    .gte('created_at', ninetyDaysAgo)
    .order('created_at', { ascending: false })
    .limit(200);

  const errorEvents: Array<{ errorType: string | null }> = (errorEventsRaw ?? []).map(
    (r: { error_type: unknown }) => ({ errorType: (r.error_type as string) ?? null }),
  );

  const model = buildLearnerModel({
    userProfiles: profiles
      ? {
          targetScore: profiles.target_score,
          weakSubjects: profiles.weak_subjects ?? [],
          strongSubjects: profiles.strong_subjects ?? [],
          abilities: (profiles.abilities as Record<string, number>) ?? {},
          pace: (profiles.pace as Record<string, unknown>) ?? {},
          preferences: (profiles.preferences as Record<string, unknown>) ?? {},
          dataRichness: profiles.data_richness ?? 0,
        }
      : null,
    knowledgeMastery: (masteryRows ?? []).map((r) => ({
      knowledgePoint: r.knowledge_point,
      level: Number(r.level),
      lastSeen: r.last_seen,
      trend: r.trend ?? 'flat',
    })),
    errorEvents,
  });

  // Generate text context for prompt injection
  const context = formatLearnerContext(model);
  return { model, context };
}

function formatLearnerContext(model: LearnerModel): string {
  if (model.dataRichness < 0.1) return '';

  const parts: string[] = [];

  if (model.weakSubjects.length) {
    parts.push(`\u8584\u5f31\u5b66\u79d1\uff1a${model.weakSubjects.join('\u3001')}`);
  }
  if (model.strongSubjects.length) {
    parts.push(`\u4f18\u52bf\u5b66\u79d1\uff1a${model.strongSubjects.join('\u3001')}`);
  }
  if (model.targetScore) {
    parts.push(`\u76ee\u6807\u5206\uff1a${model.targetScore}\u5206`);
  }

  const lowMastery = Object.entries(model.mastery)
    .filter(([, v]) => v.level < 0.4)
    .map(([k]) => k);
  if (lowMastery.length) {
    parts.push(`\u638c\u63e1\u5ea6\u8f83\u4f4e\uff1a${lowMastery.slice(0, 5).join('\u3001')}`);
  }

  if (model.errorProfile.length > 0) {
    const topErrors = model.errorProfile
      .slice(0, 3)
      .map((e) => `${e.type}(${e.count}\u6b21)`)
      .join('\u3001');
    parts.push(`\u5e38\u89c1\u9519\u8bef\uff1a${topErrors}`);
  }

  if (model.preferences.explainStyle) {
    parts.push(`\u8bb2\u89e3\u98ce\u683c\u504f\u597d\uff1a${model.preferences.explainStyle}`);
  }

  return parts.join('\u3002') + (parts.length > 0 ? '\u3002' : '');
}
