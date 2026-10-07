// One-shot: compute embeddings for question_bank rows that have NULL embedding.
// Run after DASHSCOPE_API_KEY becomes available. Idempotent.
// Usage: node scripts/seed-bank/backfill-embedding.mts
import { DatabaseSync } from 'node:sqlite';
import { sqlitePath, hasEmbeddingKey, embedTexts, embeddingText, toVectorLiteral } from './lib.mts';

const db = new DatabaseSync(sqlitePath());

type Row = { id: string; subject: string; exam_point: string | null; topic: string | null; content: string };

const rows = db
  .prepare('SELECT id, subject, exam_point, topic, content FROM question_bank WHERE embedding IS NULL')
  .all() as unknown as Row[];

if (rows.length === 0) {
  console.log('no rows need embedding');
  process.exit(0);
}

if (!hasEmbeddingKey()) {
  console.error('DASHSCOPE_API_KEY is not set — cannot compute embeddings');
  process.exit(1);
}

console.log(`${rows.length} rows to embed`);
const update = db.prepare('UPDATE question_bank SET embedding = ? WHERE id = ?');
const BATCH = 10;
let done = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  const vectors = await embedTexts(batch.map(embeddingText));
  batch.forEach((row, j) => update.run(toVectorLiteral(vectors[j]!), row.id));
  done += batch.length;
  console.log(`  ${done}/${rows.length}`);
}

const left = (db.prepare('SELECT COUNT(*) AS n FROM question_bank WHERE embedding IS NULL').get() as { n: number }).n;
console.log(`done — ${left} rows still without embedding`);
db.close();
