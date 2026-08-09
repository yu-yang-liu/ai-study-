import { getServiceClient } from '../db';
import { APP_PHASE } from '../constants';
import { getOrCreateConversation } from './conversation';
import type { AnalyzeOutput } from '../ai/structured/schemas';
import type { PlanOutput } from '../ai/structured/schemas';
import { updateKnowledgeMastery } from './mastery';
import type { GradeQuestionType, GradeResult } from './actions';

/** Create profiles + user_profiles rows for a new user (idempotent). */
export async function bootstrapUserRecords(userId: string, email: string): Promise<void> {
  const supabase = getServiceClient();

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
  const supabase = getServiceClient();

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

  const { error: aErr } = await supabase.from('question_analysis').insert({
    user_id: userId,
    phase: APP_PHASE,
    question_id: question.id,
    subject: result.subject,
    question_type: result.questionType,
    knowledge_points: result.knowledgePoints,
    difficulty: result.difficulty,
    answer: result.answer ?? null,
    analysis: result.analysis ?? null,
    exam_points: result.examPoints ?? null,
  });
  if (aErr) console.warn('persistAnalyze question_analysis:', aErr.message);

  const { error: lErr } = await supabase.from('learning_events').insert({
    user_id: userId,
    phase: APP_PHASE,
    type: 'analyze',
    subject: result.subject,
    knowledge_points: result.knowledgePoints,
  });
  if (lErr) console.warn('persistAnalyze learning_events:', lErr.message);

  await updateKnowledgeMastery(userId, result.subject, result.knowledgePoints, 'exposure');
}

export async function persistChatExchange(
  userId: string,
  subject: string,
  userMessage: string,
  assistantReply: string,
  conversationId?: string,
): Promise<string> {
  const supabase = getServiceClient();

  // 会话解析统一委托 getOrCreateConversation（id 校验 → user+subject 查找 → 新建），
  // 与 /api/chat 主链路及 chat/history 共用同一语义，避免三处重复 select/insert。
  // 注意：getOrCreateConversation 不更新 updated_at，故此处仍需手动 bump。
  const resolvedConversationId = await getOrCreateConversation(userId, subject, conversationId);

  const { error: mErr } = await supabase.from('conversation_messages').insert([
    { user_id: userId, conversation_id: resolvedConversationId, role: 'user', content: userMessage },
    { user_id: userId, conversation_id: resolvedConversationId, role: 'assistant', content: assistantReply },
  ]);
  if (mErr) console.warn('persistChat conversation_messages:', mErr.message);

  const { error: uErr } = await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', resolvedConversationId);
  if (uErr) console.warn('persistChat conversations.update:', uErr.message);

  const { error: lErr } = await supabase.from('learning_events').insert({
    user_id: userId,
    phase: APP_PHASE,
    type: 'chat',
    subject,
  });
  if (lErr) console.warn('persistChat learning_events:', lErr.message);

  return resolvedConversationId;
}

/**
 * 批改结果落库（questions + practice_records + question_analysis + wrong_questions + learning_events）。
 * 从 actions.ts 迁入，与 persistAnalyzeResult/persistPlanResult 同属落库层。
 * 严格错误检查：任一关键表插入失败即 throw，由 executeGrade 捕获后 console.warn 不阻断返回。
 */
export async function persistGradeResult(
  userId: string,
  subject: string,
  questionType: GradeQuestionType,
  questionContent: string,
  studentAnswer: string,
  result: GradeResult,
  isCorrect: boolean,
): Promise<void> {
  const supabase = getServiceClient();

  const { data: question, error: qErr } = await supabase
    .from('questions')
    .insert({
      user_id: userId,
      phase: APP_PHASE,
      subject,
      content: questionContent,
      source: 'grade',
    })
    .select('id')
    .single();

  if (qErr || !question) {
    throw new Error(`grade questions insert: ${qErr?.message ?? 'no row'}`);
  }

  const { error: prErr } = await supabase.from('practice_records').insert({
    user_id: userId,
    phase: APP_PHASE,
    question_id: question.id,
    is_correct: isCorrect,
    score: result.score,
    max_score: result.maxScore,
    user_answer: studentAnswer,
    ai_feedback: result.summary ?? null,
  });
  if (prErr) throw new Error(`grade practice_records insert: ${prErr.message}`);

  const { error: qaErr } = await supabase.from('question_analysis').insert({
    user_id: userId,
    phase: APP_PHASE,
    question_id: question.id,
    subject,
    question_type: questionType === 'math' ? '计算题' : '作文',
    knowledge_points: [],
    analysis: result.summary ?? null,
  });
  if (qaErr) throw new Error(`grade question_analysis insert: ${qaErr.message}`);

  if (!isCorrect) {
    const { data: existing } = await supabase
      .from('wrong_questions')
      .select('id')
      .eq('user_id', userId)
      .eq('question_id', question.id)
      .eq('mastered', false)
      .maybeSingle();

    if (!existing) {
      const { error: wqErr } = await supabase.from('wrong_questions').insert({
        user_id: userId,
        phase: APP_PHASE,
        question_id: question.id,
        knowledge_points: [],
        review_count: 0,
        ease_factor: 2.5,
        interval_days: 1,
      });
      if (wqErr) throw new Error(`grade wrong_questions insert: ${wqErr.message}`);
    }
  }

  const { error: evErr } = await supabase.from('learning_events').insert({
    user_id: userId,
    phase: APP_PHASE,
    type: 'grade',
    subject,
    is_correct: isCorrect,
    score: result.score,
    max_score: result.maxScore,
  });
  if (evErr) throw new Error(`grade learning_events insert: ${evErr.message}`);

  await updateKnowledgeMastery(userId, subject, [], isCorrect ? 'correct' : 'incorrect');
}

export async function persistPlanResult(userId: string, subject: string, plan: PlanOutput): Promise<void> {
  const supabase = getServiceClient();

  const { error: deErr } = await supabase
    .from('study_plans')
    .update({ active: false })
    .eq('user_id', userId)
    .eq('active', true);
  if (deErr) console.warn('persistPlan study_plans deactivate:', deErr.message);

  const { error: pErr } = await supabase.from('study_plans').insert({
    user_id: userId,
    phase: APP_PHASE,
    title: plan.title,
    description: plan.description,
    plan_data: plan,
    active: true,
  });
  if (pErr) console.warn('persistPlan study_plans insert:', pErr.message);

  const { error: lErr } = await supabase.from('learning_events').insert({
    user_id: userId,
    phase: APP_PHASE,
    type: 'plan_followed',
    subject,
  });
  if (lErr) console.warn('persistPlan learning_events:', lErr.message);
}
