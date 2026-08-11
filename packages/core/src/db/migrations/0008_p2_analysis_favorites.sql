alter table question_analysis
  add column if not exists is_favorite boolean not null default false;

create index if not exists idx_question_analysis_favorite
  on question_analysis(user_id, phase, is_favorite)
  where is_favorite = true;
