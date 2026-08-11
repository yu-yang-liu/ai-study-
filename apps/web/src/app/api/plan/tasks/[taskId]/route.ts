import { APP_PHASE, getAuthUser, getServiceClient } from '@ai-study/core';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const updateTaskSchema = z.object({
  status: z.enum(['pending', 'completed', 'skipped']),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { taskId } = await context.params;
  const parsed = updateTaskSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = getServiceClient();
  const { data: row, error: fetchError } = await supabase
    .from('study_plans')
    .select('id, plan_data')
    .eq('user_id', user.id)
    .eq('phase', APP_PHASE)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: 'Active plan not found' }, { status: 404 });

  const planData = row.plan_data && typeof row.plan_data === 'object'
    ? row.plan_data as { tasks?: Array<Record<string, unknown>> }
    : {};
  const tasks = Array.isArray(planData.tasks) ? planData.tasks : [];
  const index = tasks.findIndex((task) => String(task.taskId ?? '') === taskId);
  if (index < 0) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  const status = parsed.data.status;
  const now = new Date().toISOString();
  const nextTasks = tasks.map((task, taskIndex) => taskIndex === index
    ? {
        ...task,
        status,
        completedAt: status === 'completed' ? now : undefined,
        skippedAt: status === 'skipped' ? now : undefined,
      }
    : task);

  const { error: updateError } = await supabase
    .from('study_plans')
    .update({
      plan_data: { ...planData, tasks: nextTasks },
      updated_at: now,
    })
    .eq('id', row.id)
    .eq('user_id', user.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ task: nextTasks[index] });
}
