-- 0001_conversation_summaries.sql
-- M2 超长对话压缩/摘要：一个会话一个滚动摘要行。

------------------------------------------------------------
-- 14. conversation_summaries (M2 滚动摘要)
------------------------------------------------------------
create table conversation_summaries (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null,
  summary text not null,
  summary_up_to timestamptz not null,   -- 摘要覆盖到的最后一条消息时间
  message_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index conversation_summaries_uidx on conversation_summaries(conversation_id);

alter table conversation_summaries enable row level security;

create policy "conversation_summaries_self_access" on conversation_summaries
  for all using (user_id = auth.uid());
