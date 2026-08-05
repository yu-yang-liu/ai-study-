import type { AgentMemory } from './types';

/**
 * 纯函数：把 AgentMemory 的 longTerm 块格式化为可注入 system prompt 的片段。
 *
 * M1 中为恒等映射 —— 与 runChatAgent.ts 的 buildChatAgentSystemPrompt 行为完全等价
 * （longTerm 直接作为 assistantContext 透传）。此函数存在的意义：
 *   1. 给 M2/M3 留一个统一的「记忆 → prompt」拼接点（将来 episodic / summary 也要拼进来）
 *   2. 提供一个无需 mock DB 即可单测的纯函数
 *
 * 注意：M1 中 chat/route.ts 仍直接透传 mem.longTerm 给 runChatAgent，不强制走此函数
 * （避免改变 buildChatAgentSystemPrompt 的拼接逻辑）。但导出它供 M2+ 切换使用。
 */
export function composeMemoryBlock(mem: AgentMemory): string {
  return mem.longTerm;
}
