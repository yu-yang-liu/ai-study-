import { describe, it, expect } from 'vitest';
import { chatAgentOutput, chatAgentToolName } from '../structured/schemas';

describe('chatAgentOutput schema', () => {
  it('accepts direct reply without tool', () => {
    const parsed = chatAgentOutput.parse({ reply: '\u4f60\u597d\uff0c\u6211\u6765\u5e2e\u4f60\u3002' });
    expect(parsed.reply).toBe('\u4f60\u597d\uff0c\u6211\u6765\u5e2e\u4f60\u3002');
    expect(parsed.tool).toBeUndefined();
  });

  it('accepts tool call with args', () => {
    const parsed = chatAgentOutput.parse({
      tool: {
        name: 'generate_plan',
        args: { focus: '\u5bfc\u6570' },
      },
    });
    expect(parsed.tool?.name).toBe('generate_plan');
    expect(parsed.tool?.args.focus).toBe('\u5bfc\u6570');
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
