import { createServiceClient } from '../../db';
import { safeFetch } from '../../security';
import type { RAGReference, RetrieveOptions } from './types';

const DASHSCOPE_BASE = 'https://dashscope.aliyuncs.com';

function getEmbeddingApiKey(): string {
  return process.env.DASHSCOPE_API_KEY ?? '';
}

/** Calls DashScope text-embedding-v3 to produce a 1024-d vector for the query. */
async function embedQuery(query: string): Promise<number[]> {
  const res = await safeFetch(`${DASHSCOPE_BASE}/compatible-mode/v1/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getEmbeddingApiKey()}` },
    body: JSON.stringify({ model: 'text-embedding-v3', input: { texts: [query] } }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown');
    throw new Error(`Embedding failed ${res.status}: ${err}`);
  }

  const json: { output: { embeddings: Array<{ embedding: number[] }> } } = await res.json();
  const vec = json.output.embeddings[0]?.embedding;
  if (!vec) throw new Error('Embedding returned no vector');

  return vec;
}

function parseVectorLiteral(str: string): number[] {
  // pgvector may return "[0.1,0.2,...]" string
  return str.slice(1, -1).split(',').map(Number);
}

/** Reweights candidates by boosting exact subject match and penalizing low similarity. */
function rerank(
  candidates: Array<{
    id: string;
    examPoint: string | null;
    analysis: string | null;
    questionType: string | null;
    similarity: number;
  }>,
  subject: string,
): typeof candidates {
  return candidates
    .map((c) => ({
      ...c,
      score: c.similarity + (c.examPoint && c.examPoint.includes(subject) ? 0.05 : 0),
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Retrieves relevant references from the question bank via vector search.
 * Returns exam_points and analysis summaries only �?never raw question content.
 * Uses service_role client (RLS bypass) to call match_questions RPC.
 */
export async function retrieveReferences(opts: RetrieveOptions): Promise<RAGReference[]> {
  const embedding = await embedQuery(opts.query);
  const minScore = opts.minScore ?? 0.78;

  const supabase = createServiceClient();

  // Use pgvector match via raw SQL since match_questions is SQL function
  const { data, error } = await supabase.rpc('match_questions', {
    query_embedding: `[${embedding.join(',')}]`,
    match_subject: opts.subject,
    match_phase: opts.phase,
    match_limit: opts.limit ?? 5,
    min_score: minScore,
  });

  if (error) {
    throw new Error(`RAG match_questions failed: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    exam_point: string | null;
    analysis: string | null;
    question_type: string | null;
    similarity: number;
  }>;

  // Filter below threshold (belt-and-suspenders, already in SQL)
  const filtered = rows.filter((r) => r.similarity >= minScore);

  // Rerank and take top 3
  const ranked = rerank(
    filtered.map((r) => ({
      id: r.id,
      examPoint: r.exam_point,
      analysis: r.analysis,
      questionType: r.question_type,
      similarity: r.similarity,
    })),
    opts.subject,
  );

  // Only return exam points + scoring criteria, never raw questions
  return ranked.slice(0, 3).map((r) => ({
    examPoint: r.examPoint ?? '',
    analysis: r.analysis ?? '',
    questionType: r.questionType ?? '',
    similarity: Number(r.similarity.toFixed(3)),
  }));
}
