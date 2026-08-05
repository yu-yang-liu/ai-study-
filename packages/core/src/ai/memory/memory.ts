import { getOrCreateConversation, loadConversationMessages } from '../../learning/conversation';
import { getAssistantContext } from '../../learning/assistant-context';
import { persistChatExchange } from '../../learning/persist';
import type {
  MemoryContext,
  AgentMemory,
  TurnInput,
  MemoryFact,
  UpsertFactResult,
} from './types';

/**
 * M1 统一读入口 —— 替代 chat/route.ts 中的
 * getOrCreateConversation + Promise.all([loadConversationMessages, getAssistantContext])。
 *
 * 严格保持现有顺序：
 *   1. 先 getOrCreateConversation（必须先解析出 conversationId）
 *   2. 再 Promise.all 并行取 history + assistantContext
 * 任何重排都会改变错误传播 / 竞态语义。
 */
export async function loadMemory(ctx: MemoryContext): Promise<AgentMemory> {
  const conversationId = await getOrCreateConversation(
    ctx.userId,
    ctx.subject,
    ctx.conversationId,
  );

  const [shortTerm, { assistantText }] = await Promise.all([
    loadConversationMessages(ctx.userId, conversationId, 20),
    getAssistantContext(ctx.userId),
  ]);

  return {
    conversationId,
    shortTerm,
    longTerm: assistantText,
    episodic: undefined, // M4 钩子
    isColdStart: assistantText.length === 0,
  };
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
 * M5 桩 —— 类型化但未实现。M1 暴露此签名以锁定接口形状，让后续 Agent 可条件性调用
 * 而不需改类型。M3/M5 落地真实存储（需 user_memory_facts 表）。
 */
export async function upsertFact(
  _ctx: MemoryContext,
  _fact: MemoryFact,
): Promise<UpsertFactResult> {
  return { stored: false, reason: 'not_implemented' };
}
