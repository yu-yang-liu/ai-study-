import { createServiceClient } from '../../db';
import { APP_PHASE } from '../../constants';
import { safeFetch } from '../../security';
import type { EpisodicMemory } from './types';

const DASHSCOPE_BASE = 'https://dashscope.aliyuncs.com';

/** user_memories 事件来源枚举。 */
export type UserMemorySource = 'grade' | 'plan' | 'fact' | 'chat_conclusion';

/** 写入参数。 */
export interface StoreUserMemoryInput {
  userId: string;
  source: UserMemorySource;
  content: string;
  subject?: string;
  metadata?: Record<string, unknown>;
}

function getEmbeddingApiKey(): string {
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key) throw new Error('Missing DASHSCOPE_API_KEY');
  return key;
}

/** 调 DashScope text-embedding-v3 生成 1024 维向量。失败抛错，由调用方决定容错。 */
export async function embedUserMemory(text: string): Promise<number[]> {
  const res = await safeFetch(`${DASHSCOPE_BASE}/compatible-mode/v1/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getEmbeddingApiKey()}` },
    body: JSON.stringify({ model: 'text-embedding-v3', input: { texts: [text] } }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown');
    throw new Error(`embedUserMemory ${res.status}: ${err}`);
  }

  const json: { output: { embeddings: Array<{ embedding: number[] }> } } = await res.json();
  const vec = json.output.embeddings[0]?.embedding;
  if (!vec) throw new Error('embedUserMemory returned no vector');
  return vec;
}

/**
 * 写入一条用户经历向量（M4 写入口）。
 * embedding 失败时仍写入行（embedding 为 null），保证事件不丢；
 * 后续可由补偿任务回填。返回插入行 id。
 */
export async function storeUserMemory(opts: StoreUserMemoryInput): Promise<string> {
  const supabase = createServiceClient();

  let embedding: number[] | null = null;
  try {
    embedding = await embedUserMemory(opts.content);
  } catch (err) {
    // embedding 故障不丢事件：写入空 embedding 行，便于后续回填
    console.warn('storeUserMemory embedding failed (row saved without vector):', err);
  }

  const { data, error } = await supabase
    .from('user_memories')
    .insert({
      user_id: opts.userId,
      phase: APP_PHASE,
      source: opts.source,
      subject: opts.subject ?? null,
      content: opts.content,
      metadata: opts.metadata ?? {},
      embedding: embedding ? `[${embedding.join(',')}]` : null,
    })
    .select('id')
    .single();

  if (error || !data) throw new Error(`storeUserMemory: ${error?.message ?? 'no row'}`);
  return data.id as string;
}

/**
 * 检索用户经历向量（M6 读入口）。
 * 调 match_user_memories RPC（service_role），跨学科按语义相似度召回 Top-K。
 * 失败时返回空数组 —— 不阻断主对话。
 */
export async function retrieveUserMemory(opts: {
  query: string;
  userId: string;
  limit?: number;
  minScore?: number;
}): Promise<EpisodicMemory[]> {
  const { query, userId, limit = 5, minScore = 0.6 } = opts;

  let embedding: number[];
  try {
    embedding = await embedUserMemory(query);
  } catch (err) {
    console.warn('retrieveUserMemory embedding failed:', err);
    return [];
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('match_user_memories', {
    query_embedding: `[${embedding.join(',')}]`,
    match_user_id: userId,
    match_limit: limit,
    min_score: minScore,
  });

  if (error) {
    console.warn('retrieveUserMemory match failed:', error.message);
    return [];
  }

  const rows = (data ?? []) as Array<{
    id: string;
    source: string;
    subject: string | null;
    content: string;
    metadata: Record<string, unknown> | null;
    similarity: number;
  }>;

  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    score: Number(r.similarity.toFixed(3)),
    source: r.subject ? `${r.source}:${r.subject}` : r.source,
  }));
}
