-- 真题演练：为题库增加可筛选的考试年份。
alter table question_bank
  add column if not exists year integer;

update question_bank
set year = substring(source from '(19|20)[0-9]{2}')::integer
where year is null
  and source ~ '(19|20)[0-9]{2}';

create index if not exists idx_question_bank_phase_year
  on question_bank(phase, year);
