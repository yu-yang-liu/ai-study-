import { z, ZodError } from 'zod';
import type { TaskName, ChatMessage } from '../gateway/types';
import type { AppPhase } from '../../constants';
import { APP_PHASE } from '../../constants';
import {
  TASK_ROUTING,
  AIStructuredError,
  formatZodError,
  tryParseJson,
} from '../gateway/types';
import { pick } from '../gateway/registry';
import { recordApiUsage } from '../usage';

/**
 * Calls an AI provider for the given task, validates the output against a zod schema,
 * and retries once if validation fails. Throws AIStructuredError on second failure.
 *
 * This is the ONLY way structured AI output enters the system. No regex, no raw_content fallback.
 */
export async function structuredCall<T>(opts: {
  task: TaskName;
  schema: z.ZodType<T>;
  messages: ChatMessage[];
  imageUrls?: string[];
  userId?: string;
  phase?: AppPhase;
}): Promise<T> {
  const route = TASK_ROUTING[opts.task];
  const baseMessages = route.jsonMode
    ? [
        ...opts.messages,
        { role: 'system' as const, content: '\u8bf7\u4e25\u683c\u8f93\u51fa JSON\uff0c\u4e0d\u8981\u5305\u542b\u5176\u4ed6\u6587\u5b57\u3002' },
      ]
    : opts.messages;

  let totalUsage = { inputTokens: 0, outputTokens: 0 };

  async function attempt(msgs: ChatMessage[]): Promise<T> {
    const provider = pick(route.capability, route.fallback);
    const raw = await provider.chat({
      messages: msgs,
      temperature: route.temperature,
      jsonMode: route.jsonMode,
      imageUrls: opts.imageUrls,
    });

    if (raw.usage) {
      totalUsage.inputTokens += raw.usage.inputTokens;
      totalUsage.outputTokens += raw.usage.outputTokens;
    }

    let parsed: unknown;
    try {
      parsed = route.jsonMode ? tryParseJson(raw.content) : raw.content;
    } catch {
      throw new AIStructuredError(
        opts.task,
        new ZodError([{ code: 'custom', path: ['_parse'], message: 'AI output is not valid JSON' }]),
      );
    }

    const result = opts.schema.safeParse(parsed);
    if (result.success) return result.data;

    // Retry: feed back validation errors
    const retryMessages = [
      ...msgs,
      { role: 'assistant' as const, content: raw.content },
      {
        role: 'user' as const,
        content: `上一次输出未通过校验，错误：${formatZodError(result.error)}。请按 JSON schema 重新输出合法 JSON。`,
      },
    ];

    const retryProvider = pick(route.capability, route.fallback);
    const retryRaw = await retryProvider.chat({
      messages: retryMessages,
      temperature: 0,
      jsonMode: true,
      imageUrls: opts.imageUrls,
    });

    if (retryRaw.usage) {
      totalUsage.inputTokens += retryRaw.usage.inputTokens;
      totalUsage.outputTokens += retryRaw.usage.outputTokens;
    }

    let retryParsed: unknown;
    try {
      retryParsed = tryParseJson(retryRaw.content);
    } catch {
      throw new AIStructuredError(
        opts.task,
        new ZodError([{ code: 'custom', path: ['_parse'], message: '重试后 AI 输出仍非合法 JSON' }]),
      );
    }

    const retryResult = opts.schema.safeParse(retryParsed);
    if (retryResult.success) return retryResult.data;

    throw new AIStructuredError(opts.task, retryResult.error);
  }

  const result = await attempt(baseMessages);

  // Record combined usage from both attempts
  if (opts.userId && (totalUsage.inputTokens > 0 || totalUsage.outputTokens > 0)) {
    const provider = pick(route.capability, route.fallback);
    const modelName =
      provider.id === 'deepseek'
        ? route.capability === 'reasoning-heavy'
          ? 'deepseek-reasoner'
          : 'deepseek-chat'
        : provider.id === 'dashscope-vl'
          ? 'qwen-vl-max'
          : provider.id === 'dashscope-embedding'
            ? 'text-embedding-v3'
            : 'unknown';
    await recordApiUsage({
      userId: opts.userId,
      phase: opts.phase ?? APP_PHASE,
      provider: provider.id,
      model: modelName,
      task: opts.task,
      usage: totalUsage,
    });
  }

  return result;
}
