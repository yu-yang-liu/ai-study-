import { getServiceClient } from '../../db';
import { APP_PHASE } from '../../constants';
import type { MemoryFact } from './types';
import {
  MEMORY_FACT_CATEGORY_MAX_CHARS,
  MEMORY_FACT_CONTEXT_MAX_CHARS,
  MEMORY_FACT_KEY_MAX_CHARS,
  MEMORY_FACT_VALUE_MAX_CHARS,
  compactMemoryText,
} from './limits';

/** 跨会话事实读取上限，避免注入过多 token。 */
export const MAX_USER_FACTS = 12;

export function normalizeMemoryFact(fact: MemoryFact): MemoryFact {
  const key = compactMemoryText(fact.key, MEMORY_FACT_KEY_MAX_CHARS);
  const value = compactMemoryText(fact.value, MEMORY_FACT_VALUE_MAX_CHARS);
  const category = fact.category
    ? compactMemoryText(fact.category, MEMORY_FACT_CATEGORY_MAX_CHARS)
    : undefined;

  if (!key) throw new Error('Memory fact key must not be empty');
  if (!value) throw new Error('Memory fact value must not be empty');

  return { key, value, category: category || undefined };
}

export interface StoredFact extends MemoryFact {
  id: string;
  updatedAt: string;
}

/**
 * 读取某用户的全部跨会话事实（按更新时间倒序，限 MAX_USER_FACTS 条）。
 * 仅当前 phase（high）。失败时返回空数组 —— 不阻断主对话。
 */
export async function loadUserFacts(userId: string): Promise<StoredFact[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('user_memory_facts')
    .select('id, key, value, category, updated_at')
    .eq('user_id', userId)
    .eq('phase', APP_PHASE)
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(MAX_USER_FACTS);

  if (error) {
    console.warn('loadUserFacts failed:', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    key: row.key as string,
    value: row.value as string,
    category: (row.category as string | null) ?? undefined,
    updatedAt: row.updated_at as string,
  }));
}

/**
 * 纯函数：把用户事实列表格式化为可注入 longTerm 的块。
 * 空列表返回空串（不改变 M1 行为）。
 */
export function composeUserFactsBlock(facts: StoredFact[]): string {
  if (facts.length === 0) return '';
  const lines: string[] = [];
  let size = '【跨会话记忆】\n'.length;

  for (const fact of facts) {
    let normalized: MemoryFact;
    try {
      normalized = normalizeMemoryFact(fact);
    } catch {
      continue;
    }
    const tag = normalized.category ? `[${normalized.category}]` : '';
    const line = `- ${tag}${normalized.key}：${normalized.value}`;
    if (size + line.length + 1 > MEMORY_FACT_CONTEXT_MAX_CHARS) break;
    lines.push(line);
    size += line.length + 1;
  }

  return lines.length > 0 ? `【跨会话记忆】\n${lines.join('\n')}` : '';
}

/**
 * upsert 单条用户事实（user_id + key 唯一）。M5 写入口。
 * 返回 upsert 后的事实。
 */
export async function upsertUserFact(
  userId: string,
  fact: MemoryFact,
  sourceConversationId?: string,
): Promise<StoredFact> {
  const normalized = normalizeMemoryFact(fact);
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('user_memory_facts')
    .upsert(
      {
        user_id: userId,
        key: normalized.key,
        value: normalized.value,
        category: normalized.category ?? null,
        source_conversation_id: sourceConversationId ?? null,
        phase: APP_PHASE,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,key' },
    )
    .select('id, key, value, category, updated_at')
    .single();

  if (error || !data) {
    throw new Error(`upsertUserFact: ${error?.message ?? 'no row'}`);
  }

  return {
    id: data.id as string,
    key: data.key as string,
    value: data.value as string,
    category: (data.category as string | null) ?? undefined,
    updatedAt: data.updated_at as string,
  };
}

/** 删除某用户的指定 key 事实。返回是否删除了一行。 */
export async function forgetUserFact(userId: string, key: string): Promise<boolean> {
  const normalizedKey = compactMemoryText(key, MEMORY_FACT_KEY_MAX_CHARS);
  if (!normalizedKey) return false;

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('user_memory_facts')
    .delete({ count: 'exact' })
    .eq('user_id', userId)
    .eq('key', normalizedKey)
    .select('id');

  if (error) throw new Error(`forgetUserFact: ${error.message}`);
  return (data?.length ?? 0) > 0;
}
