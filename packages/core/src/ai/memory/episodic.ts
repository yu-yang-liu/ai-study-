import { getServiceClient } from '../../db';
import { APP_PHASE } from '../../constants';
import { safeFetch } from '../../security';
import type { EpisodicMemory } from './types';
import {
  EMBEDDING_DIMENSIONS,
  EPISODIC_MEMORY_CONTENT_MAX_CHARS,
  EPISODIC_MEMORY_MAX_RETRIEVAL,
  clampMemoryLimit,
  clampMemoryScore,
  compactMemoryText,
} from './limits';

const DASHSCOPE_BASE = 'https://dashscope.aliyuncs.com';

/** user_memories 事件来源枚举。 */
export type UserMemorySource = 'grade' | 'plan' | 'chat_conclusion';

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
  const normalizedText = compactMemoryText(text, EPISODIC_MEMORY_CONTENT_MAX_CHARS);
  if (!normalizedText) throw new Error('embedUserMemory requires non-empty text');

  const res = await safeFetch(`${DASHSCOPE_BASE}/compatible-mode/v1/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getEmbeddingApiKey()}` },
    body: JSON.stringify({ model: 'text-embedding-v3', input: { texts: [normalizedText] } }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown');
    throw new Error(`embedUserMemory ${res.status}: ${err}`);
  }

  const json: unknown = await res.json();
  const vec = (
    json as { output?: { embeddings?: Array<{ embedding?: unknown }> } }
  ).output?.embeddings?.[0]?.embedding;
  if (
    !Array.isArray(vec) ||
    vec.length !== EMBEDDING_DIMENSIONS ||
    !vec.every((value) => typeof value === 'number' && Number.isFinite(value))
  ) {
    throw new Error(`embedUserMemory returned an invalid ${EMBEDDING_DIMENSIONS}-dimensional vector`);
  }
  return vec;
}

/**
 * 写入一条用户经历向量（M4 写入口）。
 * embedding 失败时直接放弃向量写入；调用方已经持久化的业务事件不受影响。
 * 返回插入行 id。
 */
export async function storeUserMemory(opts: StoreUserMemoryInput): Promise<string> {
  const supabase = getServiceClient();
  const content = compactMemoryText(opts.content, EPISODIC_MEMORY_CONTENT_MAX_CHARS);
  if (!content) throw new Error('storeUserMemory requires non-empty content');

  const { data: existing, error: existingError } = await supabase
    .from('user_memories')
    .select('id')
    .eq('user_id', opts.userId)
    .eq('phase', APP_PHASE)
    .eq('source', opts.source)
    .eq('content', content)
    .not('embedding', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) {
    throw new Error(`storeUserMemory duplicate check: ${existingError.message}`);
  }
  if (existing?.id) return existing.id as string;

  const embedding = await embedUserMemory(content);

  const { data, error } = await supabase
    .from('user_memories')
    .insert({
      user_id: opts.userId,
      phase: APP_PHASE,
      source: opts.source,
      subject: opts.subject ?? null,
      content,
      metadata: opts.metadata ?? {},
      embedding: `[${embedding.join(',')}]`,
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
 *
 * 冷启动说明：loadMemory 仅在「有学情或跨会话事实」（非冷启动）时才调用本函数。
 * 冷启动用户无任何历史可检索，语义召回必然为空，因此跳过以省一次 embedding 调用 ——
 * 这不是 bug，而是刻意省略。
 */
export async function retrieveUserMemory(opts: {
  query: string;
  userId: string;
  limit?: number;
  minScore?: number;
}): Promise<EpisodicMemory[]> {
  const query = compactMemoryText(opts.query, EPISODIC_MEMORY_CONTENT_MAX_CHARS);
  if (!query) return [];

  const userId = opts.userId;
  const limit = clampMemoryLimit(opts.limit ?? 3, 3);
  const minScore = clampMemoryScore(opts.minScore ?? 0.6);

  let embedding: number[];
  try {
    embedding = await embedUserMemory(query);
  } catch (err) {
    console.warn('retrieveUserMemory embedding failed:', err);
    return [];
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc('match_user_memories', {
    query_embedding: `[${embedding.join(',')}]`,
    match_user_id: userId,
    match_phase: APP_PHASE,
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

  return rows
    .filter((r) => r.source !== 'fact' && Number.isFinite(r.similarity))
    .slice(0, EPISODIC_MEMORY_MAX_RETRIEVAL)
    .map((r) => ({
      id: r.id,
      content: r.content,
      score: Number(r.similarity.toFixed(3)),
      source: r.subject ? `${r.source}:${r.subject}` : r.source,
    }));
}
