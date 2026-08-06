import { getServiceClient } from '../db';
import { APP_PHASE } from '../constants';
import { getLearnerContext } from '../ai/learner/context';
import type { PlanOutput } from '../ai/structured/schemas';

export interface AssistantContextSnapshot {
  learnerText: string;
  assistantText: string;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function formatPlanSummary(planData: unknown, title: string, description: string | null): string {
  const plan = planData as PlanOutput | null;
  const tasks = plan?.tasks ?? [];
  const taskLines = tasks
    .slice(0, 5)
    .map((t) => `${t.title}(${t.subject}, ${t.estimatedMinutes}\u5206\u949f)`)
    .join('\u3001');
  const parts = [`\u5f53\u524d\u8ba1\u5212\uff1a${title}`];
  if (description) parts.push(description);
  if (taskLines) parts.push(`\u4efb\u52a1\uff1a${taskLines}`);
  return parts.join('\u3002');
}

/**
 * Aggregates learner model + active plan + wrong questions + recent practice
 * into a short text block for chat agent system prompt injection.
 */
export async function getAssistantContext(userId: string): Promise<AssistantContextSnapshot> {
  const supabase = getServiceClient();
  const [{ context: learnerText }, planRes, wrongRes, practiceRes] = await Promise.all([
    getLearnerContext(userId),
    supabase
      .from('study_plans')
      .select('title, description, plan_data')
      .eq('user_id', userId)
      .eq('phase', APP_PHASE)
      .eq('active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('wrong_questions')
      .select('id, questions ( subject, content )')
      .eq('user_id', userId)
      .eq('phase', APP_PHASE)
      .eq('mastered', false)
      .order('next_review_at', { ascending: true })
      .limit(3),
    supabase
      .from('practice_records')
      .select('is_correct, created_at')
      .eq('user_id', userId)
      .eq('phase', APP_PHASE)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const sections: string[] = [];

  if (learnerText) {
    sections.push(`\u3010\u5b66\u751f\u753b\u50cf\u3011${learnerText}`);
  }

  if (planRes.data) {
    sections.push(
      `\u3010\u5b66\u4e60\u8ba1\u5212\u3011${formatPlanSummary(
        planRes.data.plan_data,
        planRes.data.title,
        planRes.data.description,
      )}`,
    );
  }

  const wrongRows = wrongRes.data ?? [];
  if (wrongRows.length > 0) {
    const { count } = await supabase
      .from('wrong_questions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('phase', APP_PHASE)
      .eq('mastered', false);

    const previews = wrongRows
      .map((row) => {
        const q = row.questions as { subject?: string; content?: string } | { subject?: string; content?: string }[] | null;
        const question = Array.isArray(q) ? q[0] : q;
        const subject = question?.subject ?? '';
        const content = truncate(question?.content ?? '', 40);
        return `${subject}:${content}`;
      })
      .join('\u3001');
    sections.push(
      `\u3010\u9519\u9898\u590d\u4e60\u3011\u5f85\u590d\u4e60 ${count ?? wrongRows.length} \u9898\u3002\u6700\u8fd1\uff1a${previews}`,
    );
  }

  const practices = practiceRes.data ?? [];
  if (practices.length > 0) {
    const correct = practices.filter((p) => p.is_correct).length;
    const rate = Math.round((correct / practices.length) * 100);
    sections.push(
      `\u3010\u8fd1\u671f\u7ec3\u4e60\u3011\u8fd17\u5929\u5171 ${practices.length} \u6b21\uff0c\u6b63\u786e\u7387 ${rate}%`,
    );
  }

  const assistantText = sections.length > 0 ? truncate(sections.join('\n'), 800) : '';
  return { learnerText, assistantText };
}
