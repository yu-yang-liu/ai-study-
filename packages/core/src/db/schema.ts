import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  numeric,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
  customType,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ── Enum types ──
export const phaseEnum = pgEnum('phase_type', ['high', 'middle']);
export const eventTypeEnum = pgEnum('event_type', [
  'analyze',
  'grade',
  'practice',
  'chat',
  'plan_followed',
  'review',
]);

// ── Custom vector type for pgvector ──
export const vector1024 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1024)';
  },
});

// ── 1. profiles ──
export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().unique(),
    phase: phaseEnum('phase').notNull(),
    email: text('email').notNull(),
    displayName: text('display_name'),
    grade: text('grade'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
);

// ── 2. learning_events ──
export const learningEvents = pgTable(
  'learning_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    phase: phaseEnum('phase').notNull(),
    type: eventTypeEnum('type').notNull(),
    subject: text('subject').notNull(),
    knowledgePoints: text('knowledge_points').array().notNull().default([]),
    isCorrect: boolean('is_correct'),
    score: numeric('score', { precision: 5, scale: 2 }),
    maxScore: numeric('max_score', { precision: 5, scale: 2 }),
    errorType: text('error_type'),
    abilityAssessment: jsonb('ability_assessment'),
    durationSec: integer('duration_sec'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_learning_events_user_created').on(table.userId, table.createdAt.desc())],
);

// ── 3. questions ──
export const questions = pgTable('questions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  phase: phaseEnum('phase').notNull(),
  subject: text('subject').notNull(),
  content: text('content').notNull(),
  imageUrls: text('image_urls').array().default([]),
  source: text('source'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ── 4. question_analysis ──
export const questionAnalysis = pgTable('question_analysis', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  phase: phaseEnum('phase').notNull(),
  questionId: uuid('question_id')
    .notNull()
    .references(() => questions.id, { onDelete: 'cascade' }),
  subject: text('subject').notNull(),
  topic: text('topic'),
  questionType: text('question_type'),
  knowledgePoints: text('knowledge_points').array().default([]),
  difficulty: integer('difficulty'),
  answer: text('answer'),
  analysis: text('analysis'),
  examPoints: text('exam_points'),
  ragContext: jsonb('rag_context'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ── 5. practice_records ──
export const practiceRecords = pgTable('practice_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  phase: phaseEnum('phase').notNull(),
  questionId: uuid('question_id')
    .notNull()
    .references(() => questions.id, { onDelete: 'cascade' }),
  isCorrect: boolean('is_correct').notNull(),
  score: numeric('score', { precision: 5, scale: 2 }),
  maxScore: numeric('max_score', { precision: 5, scale: 2 }).default('100'),
  userAnswer: text('user_answer'),
  aiFeedback: text('ai_feedback'),
  errorType: text('error_type'),
  durationSec: integer('duration_sec'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ── 6. wrong_questions ──
export const wrongQuestions = pgTable(
  'wrong_questions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    phase: phaseEnum('phase').notNull(),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    knowledgePoints: text('knowledge_points').array().default([]),
    errorType: text('error_type'),
    reviewCount: integer('review_count').notNull().default(0),
    easeFactor: numeric('ease_factor', { precision: 4, scale: 2 }).notNull().default('2.5'),
    intervalDays: integer('interval_days').notNull().default(1),
    nextReviewAt: timestamp('next_review_at', { withTimezone: true }).defaultNow().notNull(),
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }).defaultNow().notNull(),
    mastered: boolean('mastered').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_wrong_questions_next_review')
      .on(table.userId, table.nextReviewAt)
      .where(sql`${table.mastered} = false`),
  ],
);

// ── 7. knowledge_mastery ──
export const knowledgeMastery = pgTable(
  'knowledge_mastery',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    phase: phaseEnum('phase').notNull(),
    knowledgePoint: text('knowledge_point').notNull(),
    subject: text('subject').notNull(),
    level: numeric('level', { precision: 5, scale: 2 }).notNull().default('0'),
    lastSeen: timestamp('last_seen', { withTimezone: true }).defaultNow().notNull(),
    trend: text('trend').notNull().default('flat'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('knowledge_mastery_uidx').on(table.userId, table.phase, table.knowledgePoint)],
);

// ── 8. study_plans ──
export const studyPlans = pgTable('study_plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  phase: phaseEnum('phase').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  planData: jsonb('plan_data').notNull().default({}),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ── 9. conversations ──
export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  phase: phaseEnum('phase').notNull(),
  title: text('title').notNull().default('新对话'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const conversationMessages = pgTable('conversation_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant'] }).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ── 14. conversation_summaries (M2 滚动摘要) ──
export const conversationSummaries = pgTable(
  'conversation_summaries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    summary: text('summary').notNull(),
    summaryUpTo: timestamp('summary_up_to', { withTimezone: true }).notNull(),
    messageCount: integer('message_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('conversation_summaries_uidx').on(table.conversationId)],
);

// ── 10. user_profiles ──
export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().unique(),
  phase: phaseEnum('phase').notNull(),
  targetScore: numeric('target_score', { precision: 5, scale: 2 }),
  weakSubjects: text('weak_subjects').array().default([]),
  strongSubjects: text('strong_subjects').array().default([]),
  abilities: jsonb('abilities').default({}),
  pace: jsonb('pace').default({}),
  preferences: jsonb('preferences').default({}),
  dataRichness: numeric('data_richness', { precision: 4, scale: 3 }).notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ── 11. api_usage ──
export const apiUsage = pgTable(
  'api_usage',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    phase: phaseEnum('phase').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    task: text('task').notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    cost: numeric('cost', { precision: 10, scale: 6 }).notNull().default('0'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_api_usage_user_date').on(table.userId, table.createdAt.desc())],
);

// ── 12. app_content ──
export const appContent = pgTable(
  'app_content',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    phase: phaseEnum('phase').notNull(),
    subject: text('subject').notNull(),
    contentType: text('content_type').notNull(),
    title: text('title').notNull(),
    data: jsonb('data').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('app_content_uidx').on(table.phase, table.subject, table.contentType),
    index('idx_app_content_phase_subject').on(table.phase, table.subject),
  ],
);

// ── 13. question_bank ──
export const questionBank = pgTable(
  'question_bank',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    phase: phaseEnum('phase').notNull(),
    subject: text('subject').notNull(),
    topic: text('topic'),
    examPoint: text('exam_point'),
    questionType: text('question_type'),
    content: text('content').notNull(),
    options: jsonb('options'),
    answer: text('answer'),
    analysis: text('analysis'),
    source: text('source'),
    difficulty: integer('difficulty'),
    embedding: vector1024('embedding'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_question_bank_phase_subject').on(table.phase, table.subject)],
);

// ── 15. user_memory_facts (M3/M5：用户跨会话事实) ──
export const userMemoryFacts = pgTable(
  'user_memory_facts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    key: text('key').notNull(),
    value: text('value').notNull(),
    category: text('category'),
    sourceConversationId: uuid('source_conversation_id'),
    phase: phaseEnum('phase').notNull().default('high'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('user_memory_facts_uidx').on(table.userId, table.key),
    index('idx_user_memory_facts_user').on(table.userId),
  ],
);
