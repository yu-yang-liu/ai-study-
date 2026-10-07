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
    knowledgeMastery: (masteryRows ?? []).map((r: any) => ({
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
    parts.push(`薄弱学科：${model.weakSubjects.join('、')}`);
  }
  if (model.strongSubjects.length) {
    parts.push(`优势学科：${model.strongSubjects.join('、')}`);
  }
  if (model.targetScore) {
    parts.push(`目标分：${model.targetScore}分`);
  }

  if (model.educationState) {
    const state = model.educationState;
    parts.push(`北京高中阶段：${state.grade}·${state.stage}`);
    if (state.selection.subjects.length > 0) {
      parts.push(
        `选科状态：${state.selection.status}（${state.selection.subjects.join('、')}）`,
      );
    }
    const failedSubjects = Object.entries(state.qualificationStatus)
      .filter(([, status]) => status === 'failed')
      .map(([subject]) => subject);
    if (failedSubjects.length > 0) {
      parts.push(
        `合格考待处理科目：${failedSubjects.join('、')}`,
      );
    }
  }

  const lowMastery = Object.entries(model.mastery)
    .filter(([, v]) => v.level < 0.4)
    .map(([k]) => k);
  if (lowMastery.length) {
    parts.push(`掌握度较低：${lowMastery.slice(0, 5).join('、')}`);
  }

  if (model.errorProfile.length > 0) {
    const topErrors = model.errorProfile
      .slice(0, 3)
      .map((e) => `${e.type}(${e.count}次)`)
      .join('、');
    parts.push(`常见错误：${topErrors}`);
  }

  if (model.preferences.explainStyle) {
    parts.push(`讲解风格偏好：${model.preferences.explainStyle}`);
  }

  return parts.join('。') + (parts.length > 0 ? '。' : '');
}
