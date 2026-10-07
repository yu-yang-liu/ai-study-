// Step 3: upsert tmp/seed/entries.jsonl into the local SQLite question_bank.
// Idempotent (upsert by stable id). Embedding is best-effort: without
// DASHSCOPE_API_KEY rows are stored with NULL embeddings — run
// backfill-embedding.mts once a key is available.
// Usage: node scripts/seed-bank/import-bank.mts [--dry]
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { TMP_SEED, sqlitePath, hasEmbeddingKey, embedTexts, embeddingText, toVectorLiteral } from './lib.mts';

const dry = process.argv.includes('--dry');
const dbFile = sqlitePath();

type BankEntry = {
  id: string;
  subject: string;
  year: number;
  topic: string | null;
  examPoint: string | null;
  questionType: string | null;
  content: string;
  options: string[] | null;
  answer: string | null;
  analysis: string | null;
  difficulty: number | null;
  source: string;
};

const entriesPath = join(TMP_SEED, 'entries.jsonl');
if (!existsSync(entriesPath)) {
  console.error(`missing ${entriesPath} — run parse-exam.mts first`);
  process.exit(1);
}

const entries = readFileSync(entriesPath, 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line) as BankEntry);
console.log(`entries: ${entries.length} → ${dbFile}`);

const db = new DatabaseSync(dbFile);

// Sanity check the table exists (app creates schema on first boot).
const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='question_bank'").get();
if (!table) {
  console.error('question_bank table not found — start the web app once to initialize the schema, or check SQLITE_PATH');
  process.exit(1);
}

let vectors: number[][] | null = null;
if (hasEmbeddingKey()) {
  console.log('DASHSCOPE_API_KEY present: embedding entries (10/batch)…');
  vectors = await embedTexts(entries.map(embeddingText));
} else {
  console.log('DASHSCOPE_API_KEY empty: storing NULL embeddings (RAG stays empty until backfill).');
}

const upsert = db.prepare(`
  INSERT INTO question_bank (id, phase, subject, year, topic, exam_point, question_type, content, options, answer, analysis, source, difficulty, embedding)
  VALUES (?, 'high', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    subject=excluded.subject, year=excluded.year, topic=excluded.topic, exam_point=excluded.exam_point,
    question_type=excluded.question_type, content=excluded.content, options=excluded.options,
    answer=excluded.answer, analysis=excluded.analysis, source=excluded.source,
    difficulty=excluded.difficulty, embedding=COALESCE(excluded.embedding, question_bank.embedding)
`);

if (dry) {
  console.log('dry run: no writes');
  process.exit(0);
}

db.exec('BEGIN');
try {
  entries.forEach((e, i) => {
    upsert.run(
      e.id,
      e.subject,
      e.year,
      e.topic,
      e.examPoint,
      e.questionType,
      e.content,
      e.options ? JSON.stringify(e.options) : null,
      e.answer,
      e.analysis,
      e.source,
      e.difficulty,
      vectors ? toVectorLiteral(vectors[i]!) : null,
    );
  });
  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  throw err;
}

const count = db.prepare('SELECT COUNT(*) AS n FROM question_bank').get() as { n: number };
console.log(`done — question_bank now has ${count.n} rows`);
db.close();
