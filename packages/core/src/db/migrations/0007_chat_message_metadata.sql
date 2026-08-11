-- Preserve rich Chat messages (image analysis, actions and structured blocks)
-- while keeping existing text-only conversation rows readable.
alter table conversation_messages
  add column if not exists metadata jsonb not null default '{}'::jsonb;
