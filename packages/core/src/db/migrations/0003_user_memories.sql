-- 0003_user_memories.sql
-- M4 向量/Episodic Memory：对高价值用户事件（批改结论、计划、用户声明/事实）做 embedding。
-- M6 负责 Agent 读路径（match_user_memories RPC）。

------------------------------------------------------------
-- 16. user_memories (M4/M6 用户经历向量)
------------------------------------------------------------
create table user_memories (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  phase text not null default 'high',
  source text not null,                  -- 事件来源：grade / plan / fact / chat_conclusion
  subject text,                          -- 学科（可为空，跨学科事实）
  content text not null,                 -- 事件内容摘要（用于 embedding 与注入）
  metadata jsonb not null default '{}',  -- 附加结构化字段（score、planTitle 等）
  embedding vector(1024),
  created_at timestamptz not null default now()
);

create index idx_user_memories_user on user_memories(user_id);
create index idx_user_memories_embedding on user_memories
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table user_memories enable row level security;

create policy "user_memories_self_access" on user_memories
  for all using (user_id = auth.uid());

------------------------------------------------------------
-- match_user_memories RPC（仅 service_role 调用）
-- 按 user_id 检索语义最相近的用户经历，跨学科。
------------------------------------------------------------
create or replace function match_user_memories(
  query_embedding vector(1024),
  match_user_id uuid,
  match_limit int default 5,
  min_score float default 0.6
) returns table (
  id uuid,
  source text,
  subject text,
  content text,
  metadata jsonb,
  similarity float
) language sql stable as $$
  select m.id, m.source, m.subject, m.content, m.metadata,
         1 - (m.embedding <=> query_embedding) as similarity
  from user_memories m
  where m.user_id = match_user_id
    and m.embedding is not null
    and 1 - (m.embedding <=> query_embedding) >= min_score
  order by m.embedding <=> query_embedding
  limit match_limit;
$$;

revoke execute on function match_user_memories from public, anon, authenticated;
