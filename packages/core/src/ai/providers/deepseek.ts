import { safeFetch } from '../../security';
import type { AIProvider, Capability, ChatRequest, TokenUsage } from '../gateway/types';

const DEEPSEEK_BASE = 'https://api.deepseek.com';

/** 模型选择策略：根�?capability 自动路由到合适的模型 */
export type DeepSeekModel = 'deepseek-v4-flash' | 'deepseek-v4-pro';

function getApiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error('Missing DEEPSEEK_API_KEY');
  return key;
}

function selectModel(req: ChatRequest): DeepSeekModel {
  // Deterministic structured/visual AST tasks use the stronger v4-pro model.
  if (typeof req.temperature === 'number' && req.temperature <= 0.1) return 'deepseek-v4-pro';

  // General analysis/chat uses the lower-latency v4-flash model.
  return 'deepseek-v4-flash';
}

async function callDeepSeek(model: DeepSeekModel, req: ChatRequest): Promise<{ content: string; usage?: TokenUsage }> {
  const body: Record<string, unknown> = {
    model,
    messages: req.messages,
    temperature: req.temperature ?? 0.7,
    max_tokens: req.maxTokens ?? 4096,
  };

  if (req.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const res = await safeFetch(`${DEEPSEEK_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getApiKey()}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown');
    throw new Error(`DeepSeek ${res.status}: ${err}`);
  }

  const json: {
    choices: [{ message: { content: string } }];
    usage?: { prompt_tokens: number; completion_tokens: number };
  } = await res.json();

  return {
    content: json.choices[0]?.message?.content ?? '',
    usage: json.usage
      ? { inputTokens: json.usage.prompt_tokens, outputTokens: json.usage.completion_tokens }
      : undefined,
  };
}

export function createDeepSeekProvider(): AIProvider {
  return {
    id: 'deepseek',
    supports: ['text-reasoning', 'fast-text', 'reasoning-heavy'] satisfies Capability[],
    async chat(req: ChatRequest) {
      const model = selectModel(req);
      return callDeepSeek(model, req);
    },
  };
}
