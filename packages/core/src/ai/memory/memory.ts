import { getServiceClient } from '../../db';
import { getOrCreateConversation, loadConversationMessages } from '../../learning/conversation';
import { getAssistantContext } from '../../learning/assistant-context';
import { persistChatExchange } from '../../learning/persist';
import type { ConversationMessage } from '../../learning/conversation';
import type {
  MemoryContext,
  AgentMemory,
  TurnInput,
  MemoryFact,
  UpsertFactResult,
  EpisodicMemory,
} from './types';
import {
  RAW_WINDOW,
  SUMMARY_TRIGGER,
  shouldSummarize,
  composeSummaryBlock,
  summarizeConversation,
} from './summary';
import { loadUserFacts, composeUserFactsBlock, upsertUserFact } from './facts';
import type { StoredFact } from './facts';
import { retrieveUserMemory } from './episodic';
import {
  EPISODIC_MEMORY_CONTEXT_MAX_CHARS,
  EPISODIC_MEMORY_ITEM_MAX_CHARS,
  compactMemoryText,
} from './limits';

/** 读取会话的现有滚动摘要行（若存在）。 */
async function getConversationSummary(
  userId: string,
  conversationId: string,
): Promise<{ summary: string; summaryUpTo: string; summaryUpToMessageId?: string } | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('conversation_summaries')
    .select('summary, summary_up_to, summary_up_to_message_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`getConversationSummary: ${error.message}`);
  if (!data) return null;
  return {
    summary: data.summary as string,
    summaryUpTo: data.summary_up_to as string,
    summaryUpToMessageId: (data.summary_up_to_message_id as string | null) ?? undefined,
  };
}

/** upsert 会话滚动摘要。 */
async function upsertConversationSummary(
  conversationId: string,
  userId: string,
  summary: string,
  summaryUpTo: string,
  summaryUpToMessageId: string | undefined,
  messageCount: number,
): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase.from('conversation_summaries').upsert(
    {
      conversation_id: conversationId,
      user_id: userId,
      summary,
      summary_up_to: summaryUpTo,
      summary_up_to_message_id: summaryUpToMessageId ?? null,
      message_count: messageCount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'conversation_id' },
  );
  if (error) throw new Error(`upsertConversationSummary: ${error.message}`);
}

/** 取会话消息总数。 */
async function countConversationMessages(userId: string, conversationId: string): Promise<number> {
  const supabase = getServiceClient();
  const { count, error } = await supabase
    .from('conversation_messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);
  if (error) throw new Error(`countConversationMessages: ${error.message}`);
  return count ?? 0;
}

/** 取窗口外、且 created_at > summaryUpTo 的未摘要消息（chronological）。 */
async function loadUnsummarizedOlderMessages(
  conversationId: string,
  userId: string,
  summaryUpTo: string | null,
  summaryUpToMessageId: string | null,
  rawWindow: number,
): Promise<Array<ConversationMessage & { id: string }>> {
  const supabase = getServiceClient();
  // 取除最近 rawWindow 条之外的全部消息（即更早的），按时间倒序取再 reverse
  let query = supabase
    .from('conversation_messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    // 偏移最近 rawWindow 条，取其前的全部（上限给一个合理值防止超大查询）
    .range(rawWindow, rawWindow + 199);

  if (summaryUpTo && summaryUpToMessageId) {
    query = query.or(
      `created_at.gt.${summaryUpTo},and(created_at.eq.${summaryUpTo},id.gt.${summaryUpToMessageId})`,
    );
  } else if (summaryUpTo) {
    query = query.gt('created_at', summaryUpTo);
  }

  const { data, error } = await query;
  if (error) throw new Error(`loadUnsummarizedOlderMessages: ${error.message}`);

  return (data ?? [])
    .reverse()
    .map((row) => ({
      id: row.id as string,
      role: row.role as 'user' | 'assistant',
      content: row.content as string,
      createdAt: row.created_at as string,
    }));
}

/**
 * M1 统一读入口 —— 替代 chat/route.ts 中的
 * getOrCreateConversation + Promise.all([loadConversationMessages, getAssistantContext])。
 *
 * M2 扩展：长会话（消息总数 > SUMMARY_TRIGGER）时同步懒触发滚动摘要，
 * 把早期消息压缩成摘要块拼到 longTerm 前缀；shortTerm 仍是最近 RAW_WINDOW 条 raw。
 *
 * 严格保持现有顺序：
 *   1. 先 getOrCreateConversation（必须先解析出 conversationId）
 *   2. 再 Promise.all 并行取 history + assistantContext
 * 任何重排都会改变错误传播 / 竞态语义。
 *
 * 行为保持：count <= SUMMARY_TRIGGER 时走原路径（取 20 条 raw，无摘要），与 M1 完全等价。
 */
export async function loadMemory(ctx: MemoryContext): Promise<AgentMemory> {
  const conversationId = await getOrCreateConversation(
    ctx.userId,
    ctx.subject,
    ctx.conversationId,
  );

  // count + assistantContext + 跨会话事实（M3）可并行；history 在判定后取（摘要分支需先知道 count）
  const [messageCount, { assistantText }, userFacts] = await Promise.all([
    countConversationMessages(ctx.userId, conversationId),
    getAssistantContext(ctx.userId),
    loadUserFacts(ctx.userId),
  ]);

  // M6：可选语义召回用户历史经历。用当前用户消息（或回退到 subject）作为 query。
  // 失败/无 key 时静默返回空，不阻断主对话。仅当存在学情或事实（非冷启动）才召回，避免空查询。
  let episodic: EpisodicMemory[] | undefined;
  if (!(assistantText.length === 0 && userFacts.length === 0)) {
    try {
      const hits = await retrieveUserMemory({
        query: ctx.query ?? ctx.subject,
        userId: ctx.userId,
        limit: 3,
      });
      episodic = hits.length > 0 ? hits : undefined;
    } catch (err) {
      console.warn('retrieveUserMemory failed:', err);
    }
  }

  // 短会话：原路径，无摘要（M3 事实仍注入）
  if (!shouldSummarize(messageCount)) {
    const shortTerm = await loadConversationMessages(ctx.userId, conversationId, RAW_WINDOW);
    return {
      conversationId,
      shortTerm,
      longTerm: composeLongTerm(undefined, userFacts, assistantText, episodic),
      episodic,
      isColdStart: assistantText.length === 0 && userFacts.length === 0,
    };
  }

  // 长会话：取窗口内 raw + 窗口外未摘要消息
  const [shortTerm, existingSummary] = await Promise.all([
    loadConversationMessages(ctx.userId, conversationId, RAW_WINDOW),
    getConversationSummary(ctx.userId, conversationId),
  ]);

  let summary: string | undefined = existingSummary?.summary;

  const olderUnsummarized = await loadUnsummarizedOlderMessages(
    conversationId,
    ctx.userId,
    existingSummary?.summaryUpTo ?? null,
    existingSummary?.summaryUpToMessageId ?? null,
    RAW_WINDOW,
  );

  if (olderUnsummarized.length > 0) {
    try {
      const newSummary = await summarizeConversation({
        userId: ctx.userId,
        subject: ctx.subject,
        previousSummary: existingSummary?.summary ?? null,
        messages: olderUnsummarized,
      });
      const upTo = olderUnsummarized[olderUnsummarized.length - 1]!.createdAt;
      const upToMessageId = olderUnsummarized[olderUnsummarized.length - 1]!.id;
      await upsertConversationSummary(
        conversationId,
        ctx.userId,
        newSummary,
        upTo,
        upToMessageId,
        messageCount,
      );
      summary = newSummary;
    } catch (err) {
      // 摘要 LLM 故障不阻断主对话：回退到旧摘要（或无摘要）路径
      console.warn('conversation summarize failed:', err);
    }
  }

  const longTerm = composeLongTerm(summary, userFacts, assistantText, episodic);

  return {
    conversationId,
    shortTerm,
    longTerm,
    summary,
    episodic,
    isColdStart: assistantText.length === 0 && userFacts.length === 0,
  };
}

/**
 * 纯函数：把「会话摘要 + 跨会话事实 + 学情快照 + episodic」合成最终 longTerm 块。
 * 顺序：摘要 → 跨会话事实 → episodic 经历 → 学情快照。无内容段省略，保持可读性。
 * 抽离以便单测，且让短/长会话两条路径共用同一拼接逻辑。
 */
function composeLongTerm(
  summary: string | undefined,
  userFacts: StoredFact[],
  assistantText: string,
  episodic?: EpisodicMemory[],
): string {
  const factsBlock = composeUserFactsBlock(userFacts);
  const episodicBlock = composeEpisodicBlock(episodic);
  const parts: string[] = [];
  if (summary) parts.push(composeSummaryBlock(summary, ''));
  if (factsBlock) parts.push(factsBlock);
  if (episodicBlock) parts.push(episodicBlock);
  if (assistantText) parts.push(assistantText);
  return parts.join('\n\n');
}

/** 纯函数：把 episodic 经历格式化为注入块。空/无传入返回空串。 */
export function composeEpisodicBlock(episodic?: EpisodicMemory[]): string {
  if (!episodic || episodic.length === 0) return '';
  const lines: string[] = [];
  let size = '【相关历史经历】\n'.length;

  for (const item of episodic) {
    const source = compactMemoryText(item.source, 80);
    const content = compactMemoryText(item.content, EPISODIC_MEMORY_ITEM_MAX_CHARS);
    if (!content) continue;
    const line = `- [${source}] ${content}（相似度 ${item.score}）`;
    if (size + line.length + 1 > EPISODIC_MEMORY_CONTEXT_MAX_CHARS) break;
    lines.push(line);
    size += line.length + 1;
  }

  return lines.length > 0 ? `【相关历史经历】\n${lines.join('\n')}` : '';
}

/**
 * M1 统一写入口 —— 包装 persistChatExchange。
 * 返回 conversationId（与 persistChatExchange 现有返回值一致）。
 * 不接管 runChatAgent 内部工具的副作用写入（L3 仍由工具自行落表）。
 * 不在内部捕获异常 —— 持久化失败的容错由调用方（route 层）处理，以保持
 * 「持久化失败仍返回 reply + 原 conversationId」的现有语义。
 */
export async function appendTurn(
  ctx: MemoryContext,
  turn: TurnInput,
  conversationId: string,
): Promise<string> {
  return persistChatExchange(
    ctx.userId,
    ctx.subject,
    turn.userMessage,
    turn.assistantReply,
    conversationId,
  );
}

/**
 * M5 写入口 —— upsert 一条用户跨会话事实（user_id + key 唯一）。
 * 落地真实存储（user_memory_facts 表），Agent 可通过 remember 工具调用。
 * 失败时返回 { stored: false, reason }，不抛错（由调用方决定是否阻断）。
 */
export async function upsertFact(
  ctx: MemoryContext,
  fact: MemoryFact,
): Promise<UpsertFactResult> {
  try {
    await upsertUserFact(ctx.userId, fact, ctx.conversationId);
    return { stored: true };
  } catch (err) {
    return { stored: false, reason: String(err) };
  }
}
