import { describe, it, expect } from 'vitest';
import { chatAgentOutput, chatAgentToolName } from '../structured/schemas';

describe('chatAgentOutput schema', () => {
  it('accepts direct reply without tool', () => {
    const parsed = chatAgentOutput.parse({ reply: '你好，我来帮你。' });
    expect(parsed.reply).toBe('你好，我来帮你。');
    expect(parsed.tool).toBeUndefined();
  });

  it('accepts tool call with args', () => {
    const parsed = chatAgentOutput.parse({
      tool: {
        name: 'generate_plan',
        args: { focus: '导数' },
      },
    });
    expect(parsed.tool?.name).toBe('generate_plan');
    expect(parsed.tool?.args.focus).toBe('导数');
  });

  it('rejects unknown tool names', () => {
    expect(() =>
      chatAgentOutput.parse({
        tool: { name: 'unknown_tool', args: {} },
      }),
    ).toThrow();
  });

  it('allows all supported tool names', () => {
    for (const name of chatAgentToolName.options) {
      const parsed = chatAgentOutput.parse({ tool: { name, args: {} } });
      expect(parsed.tool?.name).toBe(name);
    }
  });
});
