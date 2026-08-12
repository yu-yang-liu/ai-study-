import { createServiceClient, getServiceClient } from '../../db';
import { createClientFromToken } from '../../auth';
import type { LearnerModel } from './types';
import { buildLearnerModel } from './model';
import { beijingEducationStateSchema } from '../../beijing';

/**
 * Fetches the learner context for a given user, generating a text summary
 * for injection into AI prompts. Uses pre-aggregated user_profiles +
 * knowledge_mastery + recent error events. Returns empty string on cold start (dataRichness=0).
 */
export async function getLearnerContext(
  userId: string,
  accessToken?: string,
): Promise<{ model: LearnerModel; context: string }> {
  const supabase = accessToken ? createClientFromToken(accessToken) : getServiceClient();

  // Query user_profiles
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const { data: educationStateRow } = await supabase
    .from('beijing_education_states')
    .select(
      'region, grade, stage, selection_status, selected_subjects, selection_changed_at, qualification_status, subject_performance, policy_version, updated_at',
    )
    .eq('user_id', userId)
    .maybeSingle();

  const educationState = educationStateRow
    ? beijingEducationStateSchema.safeParse({
        region: educationStateRow.region,
        grade: educationStateRow.grade,
        stage: educationStateRow.stage,
        selection: {
          status: educationStateRow.selection_status,
          subjects: educationStateRow.selected_subjects ?? [],
          changedAt: educationStateRow.selection_changed_at ?? undefined,
        },
        qualificationStatus: educationStateRow.qualification_status ?? {},
        subjectPerformance: educationStateRow.subject_performance ?? {},
        policyVersion: educationStateRow.policy_version,
        updatedAt: educationStateRow.updated_at,
      })
    : null;

  // Query knowledge_mastery
  const { data: masteryRows } = await supabase
    .from('knowledge_mastery')
    .select('knowledge_point, level, uncertainty, evidence_count, last_seen, trend')
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
      uncertainty: Number(r.uncertainty ?? 1),
      evidenceCount: Number(r.evidence_count ?? 0),
      lastSeen: r.last_seen,
      trend: r.trend ?? 'flat',
    })),
    errorEvents,
    educationState: educationState?.success ? educationState.data : undefined,
  });

  // Generate text context for prompt injection
  const context = formatLearnerContext(model);
  return { model, context };
}

function formatLearnerContext(model: LearnerModel): string {
  if (model.dataRichness < 0.1 && !model.educationState) return '';

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

  if (model.educationState) {
    const state = model.educationState;
    parts.push(`\u5317\u4eac\u9ad8\u4e2d\u9636\u6bb5\uff1a${state.grade}\u00b7${state.stage}`);
    if (state.selection.subjects.length > 0) {
      parts.push(
        `\u9009\u79d1\u72b6\u6001\uff1a${state.selection.status}\uff08${state.selection.subjects.join('\u3001')}\uff09`,
      );
    }
    const failedSubjects = Object.entries(state.qualificationStatus)
      .filter(([, status]) => status === 'failed')
      .map(([subject]) => subject);
    if (failedSubjects.length > 0) {
      parts.push(
        `\u5408\u683c\u8003\u5f85\u5904\u7406\u79d1\u76ee\uff1a${failedSubjects.join('\u3001')}`,
      );
    }
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
