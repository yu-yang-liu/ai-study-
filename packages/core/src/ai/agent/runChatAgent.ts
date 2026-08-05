import { z } from 'zod';
import type { ChatMessage } from '../gateway/types';
import { personaSystemPrompt } from '../prompt/persona';
import { buildChatAgentSystemPrompt } from '../prompt/chatAgent';
import { structuredCall } from '../structured/call';
import {
  chatAgentOutput,
  TASK_SCHEMA,
  type ChatAction,
  type ChatAgentResult,
} from '../structured/schemas';
import type { ConversationMessage } from '../../learning/conversation';
import {
  executeAnalyze,
  executeGrade,
  executePlan,
  fetchWrongQuestionSummary,
} from '../../learning/actions';

const planArgsSchema = z.object({
  focus: z.string().optional(),
});

const analyzeArgsSchema = z.object({
  questionContent: z.string().min(10),
});

const gradeArgsSchema = z.object({
  questionContent: z.string().min(10),
  studentAnswer: z.string().min(1),
  questionType: z.enum(['math', 'essay']).default('math'),
});

function historyToMessages(history: ConversationMessage[]): ChatMessage[] {
  return history.map((m) => ({
    role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
    content: m.content,
  }));
}

async function synthesizeReply(userMessage: string, toolSummary: string, subject: string): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `${personaSystemPrompt(subject, 'high')}\n\u8bf7\u6839\u636e\u5de5\u5177\u6267\u884c\u7ed3\u679c\uff0c\u7528\u81ea\u7136\u8bed\u8a00\u56de\u590d\u5b66\u751f\u3002`,
    },
    {
      role: 'user',
      content: `\u5b66\u751f\u95ee\u9898\uff1a${userMessage}\n\n\u5de5\u5177\u7ed3\u679c\uff1a\n${toolSummary}\n\n\u8bf7\u751f\u6210\u53cb\u597d\u7684\u56de\u590d\u3002`,
    },
  ];

  const result = await structuredCall({
    task: 'chat',
    schema: TASK_SCHEMA.chat,
    messages,
    phase: 'high',
  });

  return (result as { reply: string }).reply;
}

async function executeTool(
  userId: string,
  subject: string,
  name: string,
  args: Record<string, unknown>,
): Promise<{ summary: string; action?: ChatAction; directReply?: string }> {
  switch (name) {
    case 'generate_plan': {
      const parsed = planArgsSchema.safeParse(args);
      const focus = parsed.success ? parsed.data.focus : undefined;
      const plan = await executePlan({ userId, subject, focus });
      const taskLines = plan.tasks
        .slice(0, 5)
        .map((t) => `- ${t.title} (${t.subject}, ${t.estimatedMinutes}\u5206)`)
        .join('\n');
      return {
        summary: `\u8ba1\u5212\u300a${plan.title}\u300b\uff1a${plan.description}\n${taskLines}`,
        action: { type: 'plan', payload: plan as unknown as Record<string, unknown> },
      };
    }
    case 'analyze_question': {
      const parsed = analyzeArgsSchema.safeParse(args);
      if (!parsed.success) {
        return {
          summary: '',
          directReply:
            '\u8bf7\u63d0\u4f9b\u9700\u8981\u5206\u6790\u7684\u9898\u76ee\u5185\u5bb9\uff08\u81f3\u5c11 10 \u5b57\uff09\u3002',
        };
      }
      const result = await executeAnalyze({
        userId,
        subject,
        content: parsed.data.questionContent,
      });
      return {
        summary: `\u5206\u6790\u5b8c\u6210\uff1a${result.analysis}`,
        action: { type: 'analyze', payload: result as unknown as Record<string, unknown> },
      };
    }
    case 'grade_submission': {
      const parsed = gradeArgsSchema.safeParse(args);
      if (!parsed.success) {
        return {
          summary: '',
          directReply:
            '\u6279\u6539\u9700\u8981\u9898\u76ee\u5185\u5bb9\u548c\u4f60\u7684\u4f5c\u7b54\uff0c\u8bf7\u4e00\u5e76\u63d0\u4f9b\u3002',
        };
      }
      const result = await executeGrade({
        userId,
        subject,
        questionType: parsed.data.questionType,
        questionContent: parsed.data.questionContent,
        studentAnswer: parsed.data.studentAnswer,
      });
      return {
        summary: `\u5f97\u5206 ${result.score}/${result.maxScore}\uff1a${result.summary}`,
        action: { type: 'grade', payload: result as unknown as Record<string, unknown> },
      };
    }
    case 'summarize_wrong_questions': {
      const summary = await fetchWrongQuestionSummary(userId);
      if (summary.total === 0) {
        return {
          summary: '\u5f53\u524d\u6ca1\u6709\u5f85\u590d\u4e60\u7684\u9519\u9898\u3002',
          action: { type: 'wrong_questions', payload: summary as unknown as Record<string, unknown> },
        };
      }
      const lines = summary.items.map((i) => `- [${i.subject}] ${i.preview}`).join('\n');
      return {
        summary: `\u5171 ${summary.total} \u9898\u5f85\u590d\u4e60\uff1a\n${lines}`,
        action: { type: 'wrong_questions', payload: summary as unknown as Record<string, unknown> },
      };
    }
    default:
      return { summary: '', directReply: '\u6682\u4e0d\u652f\u6301\u8be5\u64cd\u4f5c\u3002' };
  }
}

export async function runChatAgent(opts: {
  userId: string;
  subject: string;
  message: string;
  history: ConversationMessage[];
  assistantContext: string;
}): Promise<ChatAgentResult> {
  const { userId, subject, message, history, assistantContext } = opts;

  const systemPrompt = buildChatAgentSystemPrompt(subject, assistantContext);
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...historyToMessages(history),
    { role: 'user', content: message },
  ];

  const agentStep = await structuredCall({
    task: 'chatAgent',
    schema: chatAgentOutput,
    messages,
    userId,
    phase: 'high',
  });

  const parsed = chatAgentOutput.parse(agentStep);

  if (!parsed.tool) {
    return { reply: parsed.reply ?? '\u6211\u6682\u65f6\u65e0\u6cd5\u56de\u590d\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002' };
  }

  const toolResult = await executeTool(userId, subject, parsed.tool.name, parsed.tool.args ?? {});

  if (toolResult.directReply) {
    return { reply: toolResult.directReply };
  }

  const reply = await synthesizeReply(message, toolResult.summary, subject);
  return { reply, action: toolResult.action };
}
