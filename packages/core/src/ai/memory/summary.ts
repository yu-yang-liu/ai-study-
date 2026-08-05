import { structuredCall } from '../structured/call';
import { personaSystemPrompt } from '../prompt/persona';
import { TASK_SCHEMA } from '../structured/schemas';
import type { ChatMessage } from '../gateway/types';
import type { ConversationMessage } from '../../learning/conversation';

/** 最近 N 条 raw 消息注入窗口（与 loadConversationMessages 现状一致）。 */
export const RAW_WINDOW = 20;
/** 会话消息总数超过此阈值才触发摘要，避免短会话浪费 LLM 调用。 */
export const SUMMARY_TRIGGER = 30;

/**
 * 纯函数：是否需要触发摘要。count > trigger 才返回 true。
 * 抽离为纯函数以便单测。
 */
export function shouldSummarize(messageCount: number, trigger: number = SUMMARY_TRIGGER): boolean {
  return messageCount > trigger;
}

/**
 * 纯函数：把摘要拼到 longTerm 前缀。无摘要时原样返回 longTerm（M1 兼容）。
 */
export function composeSummaryBlock(summary: string | null | undefined, longTerm: string): string {
  if (!summary) return longTerm;
  return `【历史摘要】\n${summary}\n\n${longTerm}`;
}

/**
 * 纯函数：给定按时间正序的全部消息，切出「窗口内 raw（最近 rawWindow 条）」
 * 与「窗口外（更早的）」两段。两段均保持正序。
 */
export function splitWindow(
  messages: ConversationMessage[],
  rawWindow: number = RAW_WINDOW,
): { recent: ConversationMessage[]; older: ConversationMessage[] } {
  const cut = Math.max(0, messages.length - rawWindow);
  return {
    older: messages.slice(0, cut),
    recent: messages.slice(cut),
  };
}

/**
 * 调用 LLM 把「旧摘要 + 未摘要的旧消息」压缩成新的滚动摘要。
 * 复用 chat task 路由（fast-text，非 JSON 模式 —— 摘要是自由文本）。
 *
 * 失败时抛错；调用方（loadMemory）负责 catch 后回退到无摘要路径，
 * 保证摘要 LLM 故障不阻断主对话。
 */
export async function summarizeConversation(opts: {
  userId: string;
  subject: string;
  previousSummary: string | null;
  messages: ConversationMessage[]; // 未摘要的旧消息，chronological
}): Promise<string> {
  const { userId, subject, previousSummary, messages } = opts;

  const systemPrompt =
    `${personaSystemPrompt(subject, 'high')}\n\n` +
    '你的任务是把以下对话历史压缩成一段不超过 300 字的摘要。' +
    '必须保留：用户的学习目标、已制定的学习计划、已达成的结论、关键错题与薄弱点。' +
    '不要保留寒暄与无关细节。用简洁的要点式中文输出。';

  const lines = messages.map((m) => `${m.role === 'user' ? '学生' : '助手'}：${m.content}`);
  const userContent = previousSummary
    ? `已有摘要：\n${previousSummary}\n\n新增对话：\n${lines.join('\n')}\n\n请输出整合后的新摘要。`
    : `对话历史：\n${lines.join('\n')}\n\n请输出摘要。`;

  const messages2: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];

  const result = await structuredCall({
    task: 'chat',
    schema: TASK_SCHEMA.chat,
    messages: messages2,
    userId,
    phase: 'high',
  });

  return (result as { reply: string }).reply;
}
