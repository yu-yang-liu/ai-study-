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
    .map((t) => `${t.title}(${t.subject}, ${t.estimatedMinutes}分钟)`)
    .join('、');
  const parts = [`当前计划：${title}`];
  if (description) parts.push(description);
  if (taskLines) parts.push(`任务：${taskLines}`);
  return parts.join('。');
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
    sections.push(`【学生画像】${learnerText}`);
  }

  if (planRes.data) {
    sections.push(
      `【学习计划】${formatPlanSummary(
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
      .map((row: any) => {
        const q = row.questions as { subject?: string; content?: string } | { subject?: string; content?: string }[] | null;
        const question = Array.isArray(q) ? q[0] : q;
        const subject = question?.subject ?? '';
        const content = truncate(question?.content ?? '', 40);
        return `${subject}:${content}`;
      })
      .join('、');
    sections.push(
      `【错题复习】待复习 ${count ?? wrongRows.length} 题。最近：${previews}`,
    );
  }

  const practices = practiceRes.data ?? [];
  if (practices.length > 0) {
    const correct = practices.filter((p: any) => p.is_correct).length;
    const rate = Math.round((correct / practices.length) * 100);
    sections.push(
      `【近期练习】近7天共 ${practices.length} 次，正确率 ${rate}%`,
    );
  }

  const assistantText = sections.length > 0 ? truncate(sections.join('\n'), 800) : '';
  return { learnerText, assistantText };
}
