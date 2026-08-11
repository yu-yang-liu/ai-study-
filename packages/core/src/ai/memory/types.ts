import type { ConversationMessage } from '../../learning/conversation';

/** loadMemory 入参 —— 与 chat/route.ts 当前所用的字段一一对应。 */
export interface MemoryContext {
  userId: string;
  subject: string;
  /** 来自 POST body 的可选 conversationId；未传时由 getOrCreateConversation 解析/新建。 */
  conversationId?: string;
  /**
   * M6：用于 episodic 向量召回的查询文本（通常是用户当前消息）。
   * 未传时回退到 subject 做查询。仅非冷启动时才触发召回。
   */
  query?: string;
}

/**
 * M4 预留 —— M1 不实现，仅类型存在以锁定 AgentMemory 形状。
 * 未来对高价值事件（批改结论、计划、用户声明）做 embedding 后填充。
 *
 * M4/M6 已实现：episodic 现由 retrieveUserMemory 填充，score = 余弦相似度。
 */
export interface EpisodicMemory {
  id: string;
  content: string;
  score: number;
  source: string;
}

/**
 * loadMemory 产物 —— 即 Agent 在一次 turn 内可读的全部「记忆」。
 *
 * - shortTerm: L1，最近 20 条对话（chronological，与 loadConversationMessages 现状一致）
 * - longTerm:  L2，getAssistantContext 返回的 assistantText（已格式化的 ≤800 字块）
 * - episodic:  L4 语义召回的用户经历片段
 * - isColdStart: 无学情快照且无跨会话事实时为 true
 */
export interface AgentMemory {
  conversationId: string;
  shortTerm: ConversationMessage[];
  longTerm: string;
  /** M2 滚动摘要（长会话才有）；已拼入 longTerm 前缀，此字段供 M3 跨会话合成复用。 */
  summary?: string;
  episodic?: EpisodicMemory[];
  isColdStart: boolean;
}

/** appendTurn 入参。 */
export interface TurnInput {
  userMessage: string;
  assistantReply: string;
}

/**
 * 跨会话事实条目类型，由 M3/M5 的结构化表存储。
 */
export interface MemoryFact {
  key: string;
  value: string;
  category?: string;
}

export interface UpsertFactResult {
  stored: boolean;
  reason?: string;
}
