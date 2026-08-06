-- 0002_user_memory_facts.sql
-- M3 跨会话记忆合成 + M5 Agent 主动写/改 memory：按 user_id 隔离的用户事实表。
-- 一条事实 = 用户明确声明或对话中抽取的关键信息（目标院校、薄弱点、计划结论等），
-- 跨会话/跨学科复用。M3 负责注入读路径，M5 负责 Agent 写/改。

------------------------------------------------------------
-- 15. user_memory_facts (M3/M5)
------------------------------------------------------------
create table user_memory_facts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  key text not null,                 -- 事实键，如 "target_school"、"weak_topic:导数"
  value text not null,               -- 事实内容
  category text,                     -- 分类，如 goal / weak_point / preference / plan_conclusion
  source_conversation_id uuid references conversations(id) on delete set null,
  phase text not null default 'high',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 同一用户同一 key 只保留一条（upsert by key）
create unique index user_memory_facts_uidx on user_memory_facts(user_id, key);
create index idx_user_memory_facts_user on user_memory_facts(user_id);

alter table user_memory_facts enable row level security;

create policy "user_memory_facts_self_access" on user_memory_facts
  for all using (user_id = auth.uid());
