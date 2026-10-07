// Smoke-test RAG retrieval over the seeded question_bank, mirroring the
// match_questions semantics in packages/core/src/db/sqlite.ts (JS cosine,
// subject+phase filter, min_score threshold).
// Usage: node scripts/seed-bank/smoke-rag.mts [query...]  (defaults to 3 seeded questions)
import { DatabaseSync } from 'node:sqlite';
import { sqlitePath, hasEmbeddingKey, embedTexts } from './lib.mts';

const MIN_SCORE = 0.78; // same default as retrieveReferences

function cosine(left: number[], right: number[]): number {
  if (left.length === 0 || left.length !== right.length) return 0;
  let dot = 0;
  let lNorm = 0;
  let rNorm = 0;
  for (let i = 0; i < left.length; i += 1) {
    dot += left[i]! * right[i]!;
    lNorm += left[i]! ** 2;
    rNorm += right[i]! ** 2;
  }
  return lNorm && rNorm ? dot / Math.sqrt(lNorm * rNorm) : 0;
}

function vectorFromLiteral(value: unknown): number[] | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return null;
  const nums = trimmed.slice(1, -1).split(',').map(Number);
  return nums.length > 0 && nums.every(Number.isFinite) ? nums : null;
}

const db = new DatabaseSync(sqlitePath());

const rows = db
  .prepare("SELECT id, subject, exam_point, analysis, embedding FROM question_bank WHERE phase='high' AND embedding IS NOT NULL")
  .all() as unknown as Array<{ id: string; subject: string; exam_point: string | null; analysis: string | null; embedding: string }>;

console.log(`rows with embedding: ${rows.length}`);
if (!hasEmbeddingKey()) {
  console.error('DASHSCOPE_API_KEY not set — cannot run retrieval smoke test');
  process.exit(1);
}
if (rows.length === 0) {
  console.error('no embedded rows — import with a key first or run backfill-embedding.mts');
  process.exit(1);
}

type Row = { id: string; subject: string; exam_point: string | null; content: string };
const samples = (
  db.prepare("SELECT id, subject, exam_point, content FROM question_bank WHERE phase='high' AND embedding IS NOT NULL LIMIT 50").all() as unknown as Row[]
).filter((_, i) => i % 10 === 0).slice(0, 3);

const queries = process.argv.slice(2).length > 0 ? process.argv.slice(2) : samples.map((r) => [r.subject, r.exam_point, r.content].filter(Boolean).join(' '));

for (const query of queries) {
  const [qVec] = await embedTexts([query]);
  const sameSubject = (query.match(/^(语文|数学|英语|物理|化学|生物|政治|历史|地理)/) ?? [])[1];
  const candidates = rows
    .filter((r) => !sameSubject || r.subject === sameSubject)
    .map((r) => ({ ...r, similarity: cosine(qVec!, vectorFromLiteral(r.embedding) ?? []) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5)
    .filter((r) => r.similarity >= MIN_SCORE);

  console.log(`\nquery: ${query.slice(0, 60)}${query.length > 60 ? '…' : ''}`);
  if (candidates.length === 0) {
    console.log('  (no matches above threshold 0.78)');
    continue;
  }
  for (const c of candidates) {
    console.log(`  ${c.similarity.toFixed(3)}  [${c.subject}] ${c.exam_point ?? '(no exam_point)'} — ${(c.analysis ?? '').slice(0, 50)}`);
  }
}

db.close();
