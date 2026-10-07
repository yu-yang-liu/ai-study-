// Import AI-authored simulated questions from scripts/seed-bank/simulated/*.jsonl
// into the local SQLite question_bank. Ids are deterministic UUIDv5 of the
// "sim-..." refs, so re-imports are idempotent upserts.
// These are ORIGINAL practice questions written in Beijing gaokao style —
// year is left NULL and source says "AI 原创模拟题" so they never masquerade
// as real exam papers.
// Usage: node scripts/seed-bank/import-simulated.mts [--dry]
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { refToUuid, sqlitePath } from './lib.mts';

const dry = process.argv.includes('--dry');

const simDir = join(resolve(dirname(fileURLToPath(import.meta.url))), 'simulated');

type SimEntry = {
  ref: string;
  subject: string;
  topic: string | null;
  examPoint: string | null;
  questionType: string;
  content: string;
  options: string[] | null;
  answer: string;
  analysis: string;
  difficulty: number | null;
  source?: string;
};

const DEFAULT_SOURCE = 'AI 原创模拟题（北京高考风格）';

const CHOICE_TYPES = new Set(['选择题', '单选题', '多选题']);

function validate(e: SimEntry, file: string, line: number): string | null {
  if (!e.ref || !e.ref.startsWith('sim-')) return 'ref 必须以 sim- 开头';
  if (!e.content || e.content.trim().length < 8) return 'content 过短';
  if (!e.answer || String(e.answer).trim().length === 0) return '缺少 answer';
  if (!e.analysis || e.analysis.trim().length < 10) return '缺少 analysis';
  if (e.difficulty !== null && e.difficulty !== undefined
      && (!Number.isInteger(e.difficulty) || e.difficulty < 1 || e.difficulty > 10)) {
    return `difficulty 非法: ${e.difficulty}`;
  }
  if (CHOICE_TYPES.has(e.questionType)) {
    if (!Array.isArray(e.options) || e.options.length < 2) return '选择题缺少选项';
    const answers = String(e.answer).toUpperCase().replace(/[^A-D]/g, '');
    if (!answers) return `选择题答案非法: ${e.answer}`;
  }
  return null;
}

const entries: SimEntry[] = [];
const files = readdirSync(simDir).filter((f) => f.endsWith('.jsonl')).sort();
if (files.length === 0) {
  console.error(`no .jsonl files in ${simDir}`);
  process.exit(1);
}
for (const file of files) {
  const lines = readFileSync(join(simDir, file), 'utf8').split(/\r?\n/).filter(Boolean);
  for (let i = 0; i < lines.length; i += 1) {
    const e = JSON.parse(lines[i]!) as SimEntry;
    const problem = validate(e, file, i + 1);
    if (problem) {
      console.error(`${file}:${i + 1} [${e.ref}] ${problem}`);
      process.exit(1);
    }
    entries.push(e);
  }
}
console.log(`validated ${entries.length} simulated entries from ${files.length} files`);

const refs = new Set<string>();
for (const e of entries) {
  if (refs.has(e.ref)) {
    console.error(`duplicate ref: ${e.ref}`);
    process.exit(1);
  }
  refs.add(e.ref);
}

if (dry) {
  console.log('dry run: no writes');
  process.exit(0);
}

const db = new DatabaseSync(sqlitePath());
const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='question_bank'").get();
if (!table) {
  console.error('question_bank table not found — start the web app once to initialize the schema');
  process.exit(1);
}

const upsert = db.prepare(`
  INSERT INTO question_bank (id, phase, subject, year, topic, exam_point, question_type, content, options, answer, analysis, source, difficulty, embedding)
  VALUES (?, 'high', ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
  ON CONFLICT(id) DO UPDATE SET
    subject=excluded.subject, topic=excluded.topic, exam_point=excluded.exam_point,
    question_type=excluded.question_type, content=excluded.content, options=excluded.options,
    answer=excluded.answer, analysis=excluded.analysis, source=excluded.source,
    difficulty=excluded.difficulty
`);

db.exec('BEGIN');
try {
  for (const e of entries) {
    upsert.run(
      refToUuid(e.ref),
      e.subject,
      e.topic ?? null,
      e.examPoint ?? null,
      e.questionType,
      e.content,
      e.options ? JSON.stringify(e.options) : null,
      e.answer,
      e.analysis,
      e.source ?? DEFAULT_SOURCE,
      e.difficulty ?? null,
    );
  }
  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  throw err;
}

const count = db.prepare('SELECT COUNT(*) AS n FROM question_bank').get() as { n: number };
console.log(`done — question_bank now has ${count.n} rows`);
db.close();
