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
  key: z.string().trim().min(1).max(64),
  value: z.string().trim().min(1).max(300),
  category: z.string().trim().max(32).optional(),
});

const forgetFactArgsSchema = z.object({
  key: z.string().trim().min(1).max(64),
});

async function persistEpisodicMemory(input: Parameters<typeof storeUserMemory>[0]): Promise<void> {
  try {
    await storeUserMemory(input);
  } catch (error) {
    // Episodic memory is secondary; the already-persisted learning action remains usable.
    console.warn(`storeUserMemory(${input.source}) failed:`, error);
  }
}

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
      content: `${personaSystemPrompt(subject, 'high')}\n请根据工具执行结果，用自然语言回复学生。`,
    },
    {
      role: 'user',
      content: `学生问题：${userMessage}\n\n工具结果：\n${toolSummary}\n\n请生成友好的回复。`,
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
  conversationId?: string,
): Promise<{ summary: string; action?: ChatAction; directReply?: string }> {
  switch (name) {
    case 'generate_plan': {
      const parsed = planArgsSchema.safeParse(args);
      const focus = parsed.success ? parsed.data.focus : undefined;
      const plan = await executePlan({ userId, subject, focus });
      const taskLines = plan.tasks
        .slice(0, 5)
        .map((t) => `- ${t.title} (${t.subject}, ${t.estimatedMinutes}分)`)
        .join('\n');
      // M4：计划生成是高价值事件，写入用户经历向量
      await persistEpisodicMemory({
        userId,
        source: 'plan',
        subject,
        content: `${plan.title}：${plan.description}`,
        metadata: { taskCount: plan.tasks.length },
      });
      return {
        summary: `计划《${plan.title}》：${plan.description}\n${taskLines}`,
        action: { type: 'plan', payload: plan },
      };
    }
    case 'analyze_question': {
      const parsed = analyzeArgsSchema.safeParse(args);
      if (!parsed.success) {
        return {
          summary: '',
          directReply:
            '请提供需要分析的题目内容（至少 10 字）。',
        };
      }
      const result = await executeAnalyze({
        userId,
        subject,
        content: parsed.data.questionContent,
      });
      return {
        summary: `分析完成：${result.analysis}`,
        action: { type: 'analyze', payload: result },
      };
    }
    case 'grade_submission': {
      const parsed = gradeArgsSchema.safeParse(args);
      if (!parsed.success) {
        return {
          summary: '',
          directReply:
            '批改需要题目内容和你的作答，请一并提供。',
        };
      }
      const result = await executeGrade({
        userId,
        subject,
        questionType: parsed.data.questionType,
        questionContent: parsed.data.questionContent,
        studentAnswer: parsed.data.studentAnswer,
      });
      // M4：批改结论是高价值事件，写入用户经历向量
      await persistEpisodicMemory({
        userId,
        source: 'grade',
        subject,
        content: `批改 ${result.score}/${result.maxScore}：${result.summary}`,
        metadata: { score: result.score, maxScore: result.maxScore },
      });
      return {
        summary: `得分 ${result.score}/${result.maxScore}：${result.summary}`,
        action: { type: 'grade', payload: result },
      };
    }
    case 'summarize_wrong_questions': {
      const summary = await fetchWrongQuestionSummary(userId);
      if (summary.total === 0) {
        return {
          summary: '当前没有待复习的错题。',
          action: { type: 'wrong_questions', payload: summary },
        };
      }
      const lines = summary.items.map((i) => `- [${i.subject}] ${i.preview}`).join('\n');
      return {
        summary: `共 ${summary.total} 题待复习：\n${lines}`,
        action: { type: 'wrong_questions', payload: summary },
      };
    }
    case 'remember_fact': {
      const parsed = rememberFactArgsSchema.safeParse(args);
      if (!parsed.success) {
        return { summary: '', directReply: '请提供要记住的事实键与内容。' };
      }
      await upsertUserFact(userId, {
        key: parsed.data.key,
        value: parsed.data.value,
        category: parsed.data.category,
      }, conversationId);
      return {
        summary: `已记住：${parsed.data.key} = ${parsed.data.value}`,
        directReply: `好的，我记下了「${parsed.data.value}」，之后会跨会话记住这点。`,
      };
    }
    case 'forget_fact': {
      const parsed = forgetFactArgsSchema.safeParse(args);
      if (!parsed.success) {
        return { summary: '', directReply: '请提供要删除的事实键。' };
      }
      const removed = await forgetUserFact(userId, parsed.data.key);
      return {
        summary: removed ? `已删除：${parsed.data.key}` : `未找到：${parsed.data.key}`,
        directReply: removed
          ? `已忘记「${parsed.data.key}」。`
          : `本来就没有记过「${parsed.data.key}」哦。`,
      };
    }
    default:
      return { summary: '', directReply: '暂不支持该操作。' };
  }
}

export async function runChatAgent(opts: {
  userId: string;
  subject: string;
  message: string;
  history: ConversationMessage[];
  assistantContext: string;
  conversationId?: string;
}): Promise<ChatAgentResult> {
  const { userId, subject, message, history, assistantContext, conversationId } = opts;

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
      reply: parsed.reply ?? '我暂时无法回复，请稍后再试。',
      replyBlocks: sanitizeBlocks(parsed.replyBlocks),
    };
  }

  const toolResult = await executeTool(
    userId,
    subject,
    parsed.tool.name,
    parsed.tool.args ?? {},
    conversationId,
  );

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
