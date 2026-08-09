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
  type Block,
} from '../structured/schemas';
import type { ConversationMessage } from '../../learning/conversation';
import {
  executeAnalyze,
  executeGrade,
  executePlan,
  fetchWrongQuestionSummary,
} from '../../learning/actions';
import { upsertUserFact, forgetUserFact } from '../memory/facts';
import { storeUserMemory } from '../memory/episodic';
import { sanitizeBlocks } from '../structured/blocks';

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

const rememberFactArgsSchema = z.object({
  key: z.string().min(1).max(64),
  value: z.string().min(1).max(300),
  category: z.string().max(32).optional(),
});

const forgetFactArgsSchema = z.object({
  key: z.string().min(1).max(64),
});

function historyToMessages(history: ConversationMessage[]): ChatMessage[] {
  return history.map((m) => ({
    role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
    content: m.content,
  }));
}

async function synthesizeReply(
  userMessage: string,
  toolSummary: string,
  subject: string,
): Promise<{ reply: string; replyBlocks?: Block[] }> {
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

  const output = result as { reply: string; replyBlocks?: Block[] };
  return { reply: output.reply, replyBlocks: output.replyBlocks };
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
      // M4\uff1a\u8ba1\u5212\u751f\u6210\u662f\u9ad8\u4ef7\u503c\u4e8b\u4ef6\uff0c\u5199\u5165\u7528\u6237\u7ecf\u5386\u5411\u91cf
      void storeUserMemory({
        userId,
        source: 'plan',
        subject,
        content: `${plan.title}\uff1a${plan.description}`,
        metadata: { taskCount: plan.tasks.length },
      }).catch((e) => console.warn('storeUserMemory(plan) failed:', e));
      return {
        summary: `\u8ba1\u5212\u300a${plan.title}\u300b\uff1a${plan.description}\n${taskLines}`,
        action: { type: 'plan', payload: plan },
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
        action: { type: 'analyze', payload: result },
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
      // M4\uff1a\u6279\u6539\u7ed3\u8bba\u662f\u9ad8\u4ef7\u503c\u4e8b\u4ef6\uff0c\u5199\u5165\u7528\u6237\u7ecf\u5386\u5411\u91cf
      void storeUserMemory({
        userId,
        source: 'grade',
        subject,
        content: `\u6279\u6539 ${result.score}/${result.maxScore}\uff1a${result.summary}`,
        metadata: { score: result.score, maxScore: result.maxScore },
      }).catch((e) => console.warn('storeUserMemory(grade) failed:', e));
      return {
        summary: `\u5f97\u5206 ${result.score}/${result.maxScore}\uff1a${result.summary}`,
        action: { type: 'grade', payload: result },
      };
    }
    case 'summarize_wrong_questions': {
      const summary = await fetchWrongQuestionSummary(userId);
      if (summary.total === 0) {
        return {
          summary: '\u5f53\u524d\u6ca1\u6709\u5f85\u590d\u4e60\u7684\u9519\u9898\u3002',
          action: { type: 'wrong_questions', payload: summary },
        };
      }
      const lines = summary.items.map((i) => `- [${i.subject}] ${i.preview}`).join('\n');
      return {
        summary: `\u5171 ${summary.total} \u9898\u5f85\u590d\u4e60\uff1a\n${lines}`,
        action: { type: 'wrong_questions', payload: summary },
      };
    }
    case 'remember_fact': {
      const parsed = rememberFactArgsSchema.safeParse(args);
      if (!parsed.success) {
        return { summary: '', directReply: '\u8bf7\u63d0\u4f9b\u8981\u8bb0\u4f4f\u7684\u4e8b\u5b9e\u952e\u4e0e\u5185\u5bb9\u3002' };
      }
      await upsertUserFact(userId, {
        key: parsed.data.key,
        value: parsed.data.value,
        category: parsed.data.category,
      });
      // M4：用户明确声明的事实也是高价值事件，写入经历向量
      void storeUserMemory({
        userId,
        source: 'fact',
        content: `${parsed.data.key}：${parsed.data.value}`,
        metadata: { category: parsed.data.category ?? null },
      }).catch((e) => console.warn('storeUserMemory(fact) failed:', e));
      return {
        summary: `\u5df2\u8bb0\u4f4f\uff1a${parsed.data.key} = ${parsed.data.value}`,
        directReply: `\u597d\u7684\uff0c\u6211\u8bb0\u4e0b\u4e86\u300c${parsed.data.value}\u300d\uff0c\u4e4b\u540e\u4f1a\u8de8\u4f1a\u8bdd\u8bb0\u4f4f\u8fd9\u70b9\u3002`,
      };
    }
    case 'forget_fact': {
      const parsed = forgetFactArgsSchema.safeParse(args);
      if (!parsed.success) {
        return { summary: '', directReply: '\u8bf7\u63d0\u4f9b\u8981\u5220\u9664\u7684\u4e8b\u5b9e\u952e\u3002' };
      }
      const removed = await forgetUserFact(userId, parsed.data.key);
      return {
        summary: removed ? `\u5df2\u5220\u9664\uff1a${parsed.data.key}` : `\u672a\u627e\u5230\uff1a${parsed.data.key}`,
        directReply: removed
          ? `\u5df2\u5fd8\u8bb0\u300c${parsed.data.key}\u300d\u3002`
          : `\u672c\u6765\u5c31\u6ca1\u6709\u8bb0\u8fc7\u300c${parsed.data.key}\u300d\u54e6\u3002`,
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

  // structuredCall 内部已对 schema 做过 safeParse（含一次重试），此处返回值即校验通过的 T，
  // 无需再次 chatAgentOutput.parse(agentStep)（原 A4：冗余二次解析）。
  const parsed = agentStep;

  if (!parsed.tool) {
    return {
      reply: parsed.reply ?? '\u6211\u6682\u65f6\u65e0\u6cd5\u56de\u590d\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002',
      replyBlocks: sanitizeBlocks(parsed.replyBlocks),
    };
  }

  const toolResult = await executeTool(userId, subject, parsed.tool.name, parsed.tool.args ?? {});

  if (toolResult.directReply) {
    return { reply: toolResult.directReply };
  }

  const synthesized = await synthesizeReply(message, toolResult.summary, subject);
  return {
    reply: synthesized.reply,
    replyBlocks: sanitizeBlocks(synthesized.replyBlocks),
    action: toolResult.action,
  };
}
