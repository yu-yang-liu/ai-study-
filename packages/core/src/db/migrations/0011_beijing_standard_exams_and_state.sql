-- Beijing standard-exam calibration data is platform-curated, not user memory.
create table if not exists standard_exams (
  exam_id text primary key,
  schema_version text not null,
  exam_type text not null default 'standard_exam',
  exam_stage text not null,
  subject text not null,
  grade text not null,
  region text not null,
  exam_date date not null,
  max_raw_score numeric(7,2) not null,
  max_converted_score numeric(7,2),
  candidate_count integer,
  source_level text not null,
  source_name text not null,
  source_url text,
  verification_status text not null default 'pending',
  policy_version text,
  raw_payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists standard_exam_records (
  id uuid primary key default uuid_generate_v4(),
  exam_id text not null references standard_exams(exam_id) on delete cascade,
  record_key text not null,
  raw_score numeric(7,2),
  raw_score_min numeric(7,2),
  raw_score_max numeric(7,2),
  rank integer,
  percentile numeric(7,6),
  percentile_definition text,
  converted_score numeric(7,2),
  grade_band text,
  record_type text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(exam_id, record_key)
);

-- User-level state is intentionally separate from platform calibration data and Agent Memory.
create table if not exists beijing_education_states (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique,
  region text not null default '北京',
  grade text not null,
  stage text not null,
  selection_status text not null default 'not_started',
  selected_subjects text[] not null default '{}',
  selection_changed_at date,
  qualification_status jsonb not null default '{}',
  subject_performance jsonb not null default '{}',
  policy_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table beijing_education_states enable row level security;

create policy "beijing_education_states_self_access" on beijing_education_states
  for all using (user_id = auth.uid());

create index if not exists idx_standard_exam_subject_date
  on standard_exams(subject, exam_date desc);
create index if not exists idx_standard_exam_records_exam
  on standard_exam_records(exam_id, raw_score);
