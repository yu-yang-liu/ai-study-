-- Evidence-aware mastery state. Existing rows remain valid through defaults.
alter table knowledge_mastery
  add column if not exists uncertainty numeric(5,4) not null default 1,
  add column if not exists evidence_count integer not null default 0,
  add column if not exists mastery_version text not null default 'legacy-v1';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'knowledge_mastery_uncertainty_range'
  ) then
    alter table knowledge_mastery
      add constraint knowledge_mastery_uncertainty_range
      check (uncertainty >= 0 and uncertainty <= 1);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'knowledge_mastery_evidence_count_nonnegative'
  ) then
    alter table knowledge_mastery
      add constraint knowledge_mastery_evidence_count_nonnegative
      check (evidence_count >= 0);
  end if;
end $$;
