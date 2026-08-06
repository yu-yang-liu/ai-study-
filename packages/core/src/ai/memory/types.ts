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
 * - episodic:  L4 钩子，M1 恒为 undefined；M4 起填充向量召回片段
 * - isColdStart: 派生自 longTerm === ''，表示新用户无学情快照
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
 * M5 预留的事实条目类型 —— 仅声明，M1 不实现存储。
 * upsertFact 在 M1 中是 no-op 桩，返回 { stored: false, reason: 'not_implemented' }。
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
