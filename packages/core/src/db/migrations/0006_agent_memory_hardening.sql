-- Agent Memory hardening:
-- 1) use a message id as a deterministic summary cursor when timestamps tie;
-- 2) isolate episodic retrieval by phase;
-- 3) keep exact facts out of semantic episodic retrieval.

alter table conversation_summaries
  add column if not exists summary_up_to_message_id uuid
  references conversation_messages(id) on delete set null;

create index if not exists idx_user_memories_user_phase_created
  on user_memories(user_id, phase, created_at desc);

drop function if exists match_user_memories(vector, uuid, integer, double precision);

create or replace function match_user_memories(
  query_embedding vector(1024),
  match_user_id uuid,
  match_phase text default 'high',
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
    and m.phase = match_phase
    and m.source <> 'fact'
    and m.embedding is not null
    and 1 - (m.embedding <=> query_embedding) >= greatest(0, least(coalesce(min_score, 0.6), 1))
  order by m.embedding <=> query_embedding
  limit greatest(1, least(coalesce(match_limit, 5), 20));
$$;

revoke execute on function match_user_memories from public, anon, authenticated;
