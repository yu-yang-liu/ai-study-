import { describe, it, expect } from 'vitest';
import { CHAT_AGENT_TASK_INSTRUCTION, buildChatAgentSystemPrompt } from './chatAgent';
import { getTaskInstruction } from './tasks';

describe('chatAgent prompts', () => {
  it('tasks.ts reuses shared chatAgent instruction', () => {
    expect(getTaskInstruction('chatAgent')).toBe(CHAT_AGENT_TASK_INSTRUCTION);
  });

  it('buildChatAgentSystemPrompt adds persona and optional snapshot', () => {
    const withoutContext = buildChatAgentSystemPrompt('\u6570\u5b66');
    expect(withoutContext).toContain('\u9ad8\u8003\u6570\u5b66\u6559\u5e08');
    expect(withoutContext).toContain('generate_plan');

    const withContext = buildChatAgentSystemPrompt('\u6570\u5b66', '\u6700\u8fd1\u7ec3\u4e60 5 \u9898');
    expect(withContext).toContain('\u3010\u5b66\u751f\u5b66\u60c5\u5feb\u7167\u3011');
    expect(withContext).toContain('\u6700\u8fd1\u7ec3\u4e60 5 \u9898');
  });
});
