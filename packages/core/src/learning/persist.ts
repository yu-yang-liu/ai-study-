import { createServiceClient } from '../db';
import { APP_PHASE } from '../constants';
import type { AnalyzeOutput } from '../ai/structured/schemas';
import type { PlanOutput } from '../ai/structured/schemas';
import { updateKnowledgeMastery } from './mastery';

/** Create profiles + user_profiles rows for a new user (idempotent). */
export async function bootstrapUserRecords(userId: string, email: string): Promise<void> {
  const supabase = createServiceClient();

  await supabase.from('profiles').upsert(
    { user_id: userId, phase: APP_PHASE, email },
    { onConflict: 'user_id' },
  );

  await supabase.from('user_profiles').upsert(
    {
      user_id: userId,
      phase: APP_PHASE,
      weak_subjects: [],
      strong_subjects: [],
      abilities: {},
      pace: {},
      preferences: {},
      data_richness: 0,
    },
    { onConflict: 'user_id' },
  );
}

export async function persistAnalyzeResult(
  userId: string,
  input: { subject: string; content: string; imageUrl?: string },
  result: AnalyzeOutput,
): Promise<void> {
  const supabase = createServiceClient();

  const { data: question, error: qErr } = await supabase
    .from('questions')
    .insert({
      user_id: userId,
      phase: APP_PHASE,
      subject: result.subject ?? input.subject,
      content: input.content || input.imageUrl || '',
      image_urls: input.imageUrl ? [input.imageUrl] : [],
      source: input.imageUrl ? 'analyze_img' : 'analyze',
    })
    .select('id')
    .single();

  if (qErr || !question) throw new Error(`persistAnalyze questions: ${qErr?.message}`);

  await supabase.from('question_analysis').insert({
    user_id: userId,
    phase: APP_PHASE,
    question_id: question.id,
    subject: result.subject,
    question_type: result.questionType,
    knowledge_points: result.knowledgePoints,
    difficulty: result.difficulty,
    answer: result.answer ?? null,
    analysis: result.analysis,
    exam_points: result.examPoints ?? null,
  });

  await supabase.from('learning_events').insert({
    user_id: userId,
    phase: APP_PHASE,
    type: 'analyze',
    subject: result.subject,
    knowledge_points: result.knowledgePoints,
  });

  await updateKnowledgeMastery(userId, result.subject, result.knowledgePoints, 'exposure');
}

export async function persistChatExchange(
  userId: string,
  subject: string,
  userMessage: string,
  assistantReply: string,
  conversationId?: string,
): Promise<string> {
  const supabase = createServiceClient();

  let resolvedConversationId = conversationId;

  if (resolvedConversationId) {
    const { data: existingById } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', resolvedConversationId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!existingById?.id) resolvedConversationId = undefined;
  }

  if (!resolvedConversationId) {
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId)
      .eq('phase', APP_PHASE)
      .eq('title', subject)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    resolvedConversationId = existing?.id as string | undefined;

    if (!resolvedConversationId) {
      const { data: created, error } = await supabase
        .from('conversations')
        .insert({ user_id: userId, phase: APP_PHASE, title: subject })
        .select('id')
        .single();
      if (error || !created) throw new Error(`persistChat conversation: ${error?.message}`);
      resolvedConversationId = created.id;
    }
  }

  await supabase.from('conversation_messages').insert([
    { user_id: userId, conversation_id: resolvedConversationId, role: 'user', content: userMessage },
    { user_id: userId, conversation_id: resolvedConversationId, role: 'assistant', content: assistantReply },
  ]);

  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', resolvedConversationId);

  await supabase.from('learning_events').insert({
    user_id: userId,
    phase: APP_PHASE,
    type: 'chat',
    subject,
  });

  return resolvedConversationId as string;
}

export async function persistPlanResult(userId: string, subject: string, plan: PlanOutput): Promise<void> {
  const supabase = createServiceClient();

  await supabase.from('study_plans').update({ active: false }).eq('user_id', userId).eq('active', true);

  await supabase.from('study_plans').insert({
    user_id: userId,
    phase: APP_PHASE,
    title: plan.title,
    description: plan.description,
    plan_data: plan,
    active: true,
  });

  await supabase.from('learning_events').insert({
    user_id: userId,
    phase: APP_PHASE,
    type: 'plan_followed',
    subject,
  });
}
