-- 0000_initial.sql
-- 中学 AI 学习系统 · 数据库初始迁移
-- 唯一真理来源；Drizzle schema 由此衍生。

create extension if not exists "uuid-ossp";
create extension if not exists "vector";

------------------------------------------------------------
-- Enum 类型
------------------------------------------------------------
do $$ begin
  create type phase_type as enum ('high', 'middle');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type event_type as enum ('analyze','grade','practice','chat','plan_followed','review');
exception when duplicate_object then null;
end $$;

------------------------------------------------------------
-- 1. profiles
------------------------------------------------------------
create table profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique,
  phase phase_type not null,
  email text not null,
  display_name text,
  grade text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table profiles enable row level security;

create policy "profiles_self_access" on profiles
  for all using (user_id = auth.uid());

------------------------------------------------------------
-- 2. learning_events
------------------------------------------------------------
create table learning_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  phase phase_type not null,
  type event_type not null,
  subject text not null,
  knowledge_points text[] not null default '{}',
  is_correct boolean,
  score numeric(5,2),
  max_score numeric(5,2),
  error_type text,
  ability_assessment jsonb,
  duration_sec integer,
  created_at timestamptz not null default now()
);
alter table learning_events enable row level security;

create policy "learning_events_self_access" on learning_events
  for all using (user_id = auth.uid());

create index idx_learning_events_user_created on learning_events(user_id, created_at desc);

------------------------------------------------------------
-- 3. questions
------------------------------------------------------------
create table questions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  phase phase_type not null,
  subject text not null,
  content text not null,
  image_urls text[] default '{}',
  source text,
  created_at timestamptz not null default now()
);
alter table questions enable row level security;

create policy "questions_self_access" on questions
  for all using (user_id = auth.uid());

------------------------------------------------------------
-- 4. question_analysis
------------------------------------------------------------
create table question_analysis (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  phase phase_type not null,
  question_id uuid not null references questions(id) on delete cascade,
  subject text not null,
  topic text,
  question_type text,
  knowledge_points text[] default '{}',
  difficulty integer,
  answer text,
  analysis text,
  exam_points text,
  rag_context jsonb,
  created_at timestamptz not null default now()
);
alter table question_analysis enable row level security;

create policy "question_analysis_self_access" on question_analysis
  for all using (user_id = auth.uid());

------------------------------------------------------------
-- 5. practice_records
------------------------------------------------------------
create table practice_records (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  phase phase_type not null,
  question_id uuid not null references questions(id) on delete cascade,
  is_correct boolean not null,
  score numeric(5,2),
  max_score numeric(5,2) default 100,
  user_answer text,
  ai_feedback text,
  error_type text,
  duration_sec integer,
  created_at timestamptz not null default now()
);
alter table practice_records enable row level security;

create policy "practice_records_self_access" on practice_records
  for all using (user_id = auth.uid());

------------------------------------------------------------
-- 6. wrong_questions
------------------------------------------------------------
create table wrong_questions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  phase phase_type not null,
  question_id uuid not null references questions(id) on delete cascade,
  knowledge_points text[] default '{}',
  error_type text,
  review_count integer not null default 0,
  ease_factor numeric(4,2) not null default 2.5,
  interval_days integer not null default 1,
  next_review_at timestamptz not null default now(),
  last_reviewed_at timestamptz not null default now(),
  mastered boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table wrong_questions enable row level security;

create policy "wrong_questions_self_access" on wrong_questions
  for all using (user_id = auth.uid());

create index idx_wrong_questions_next_review on wrong_questions(user_id, next_review_at) where not mastered;

------------------------------------------------------------
-- 7. knowledge_mastery
------------------------------------------------------------
create table knowledge_mastery (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  phase phase_type not null,
  knowledge_point text not null,
  subject text not null,
  level numeric(5,2) not null default 0,
  last_seen timestamptz not null default now(),
  trend text not null default 'flat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, phase, knowledge_point)
);
alter table knowledge_mastery enable row level security;

create policy "knowledge_mastery_self_access" on knowledge_mastery
  for all using (user_id = auth.uid());

------------------------------------------------------------
-- 8. study_plans
------------------------------------------------------------
create table study_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  phase phase_type not null,
  title text not null,
  description text,
  plan_data jsonb not null default '{}',
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table study_plans enable row level security;

create policy "study_plans_self_access" on study_plans
  for all using (user_id = auth.uid());

------------------------------------------------------------
-- 9. conversations
------------------------------------------------------------
create table conversations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  phase phase_type not null,
  title text not null default '新对话',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table conversations enable row level security;

create policy "conversations_self_access" on conversations
  for all using (user_id = auth.uid());

create table conversation_messages (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
alter table conversation_messages enable row level security;

create policy "conversation_messages_self_access" on conversation_messages
  for all using (user_id = auth.uid());

------------------------------------------------------------
-- 10. user_profiles (画像)
------------------------------------------------------------
create table user_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique,
  phase phase_type not null,
  target_score numeric(5,2),
  weak_subjects text[] default '{}',
  strong_subjects text[] default '{}',
  abilities jsonb default '{}',
  pace jsonb default '{}',
  preferences jsonb default '{}',
  data_richness numeric(4,3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table user_profiles enable row level security;

create policy "user_profiles_self_access" on user_profiles
  for all using (user_id = auth.uid());

------------------------------------------------------------
-- 11. api_usage
------------------------------------------------------------
create table api_usage (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  phase phase_type not null,
  provider text not null,
  model text not null,
  task text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost numeric(10,6) not null default 0,
  created_at timestamptz not null default now()
);
alter table api_usage enable row level security;

create policy "api_usage_self_access" on api_usage
  for select using (user_id = auth.uid());

-- Admin can insert via service_role
create policy "api_usage_admin_insert" on api_usage
  for insert with check (true);

create index idx_api_usage_user_date on api_usage(user_id, created_at desc);

------------------------------------------------------------
-- 12. app_content
------------------------------------------------------------
create table app_content (
  id uuid primary key default uuid_generate_v4(),
  phase phase_type not null,
  subject text not null,
  content_type text not null,
  title text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(phase, subject, content_type)
);
alter table app_content enable row level security;

-- Public readable
create policy "app_content_public_read" on app_content
  for select using (true);

-- Admin write only (checked at app layer via isAdmin; no RLS sufficient for write guard)
create policy "app_content_admin_write" on app_content
  for insert with check (true);
create policy "app_content_admin_update" on app_content
  for update using (true);
create policy "app_content_admin_delete" on app_content
  for delete using (true);

create index idx_app_content_phase_subject on app_content(phase, subject);

------------------------------------------------------------
-- 13. question_bank (题库，RAG 专用，不对用户公开)
------------------------------------------------------------
create table question_bank (
  id uuid primary key default uuid_generate_v4(),
  phase phase_type not null,
  subject text not null,
  topic text,
  exam_point text,
  question_type text,
  content text not null,
  options jsonb,
  answer text,
  analysis text,
  source text,
  difficulty integer,
  embedding vector(1024),
  created_at timestamptz not null default now()
);
alter table question_bank enable row level security;

-- 禁止 anon/authenticated 读取，仅 service_role 在 RAG 路径使用
-- (no select policy = denied by default)

create index idx_question_bank_phase_subject on question_bank(phase, subject);

-- pgvector IVF 索引（数据 >1000 条后生效）
create index idx_question_bank_embedding on question_bank
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

------------------------------------------------------------
-- match_questions RPC（仅 service_role 调用）
------------------------------------------------------------
create or replace function match_questions(
  query_embedding vector(1024),
  match_subject text,
  match_phase text,
  match_limit int default 5,
  min_score float default 0.78
) returns table (
  id uuid,
  content text,
  answer text,
  analysis text,
  exam_point text,
  source text,
  question_type text,
  similarity float
) language sql stable as $$
  select q.id, q.content, q.answer, q.analysis, q.exam_point, q.source, q.question_type,
         1 - (q.embedding <=> query_embedding) as similarity
  from question_bank q
  where q.subject = match_subject and q.phase::text = match_phase
    and q.embedding is not null
    and 1 - (q.embedding <=> query_embedding) >= min_score
  order by q.embedding <=> query_embedding
  limit match_limit;
$$;

-- 仅 service_role 可执行
revoke execute on function match_questions from public, anon, authenticated;
