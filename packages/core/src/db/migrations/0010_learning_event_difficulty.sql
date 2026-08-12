alter table learning_events
  add column if not exists difficulty integer;

alter table learning_events
  add constraint learning_events_difficulty_range
  check (difficulty is null or (difficulty >= 1 and difficulty <= 10));
