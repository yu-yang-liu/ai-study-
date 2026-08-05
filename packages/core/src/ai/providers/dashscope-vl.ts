import { safeFetch } from '../../security';
import type { AIProvider, Capability, ChatRequest, TokenUsage } from '../gateway/types';

let DASHSCOPE_BASE = 'https://dashscope.aliyuncs.com';

function getApiKey(): string {
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key) throw new Error('Missing DASHSCOPE_API_KEY');
  return key;
}

async function callDashScopeVL(model: string, req: ChatRequest): Promise<{ content: string; usage?: TokenUsage }> {
  // qwen-vl API uses multimodal content array
  const contents: Array<{ text?: string; image?: string }> = [];

  if (req.imageUrls?.length) {
    for (const url of req.imageUrls) {
      contents.push({ image: url });
    }
  }

  const textContent = req.messages.map((m) => `${m.role}: ${m.content}`).join('\n');
  contents.push({ text: textContent });

  const body: Record<string, unknown> = {
    model,
    input: { messages: [{ role: 'user', content: contents }] },
    parameters: {
      temperature: req.temperature ?? 0.3,
      max_tokens: req.maxTokens ?? 4096,
    },
  };

  const res = await safeFetch(`${DASHSCOPE_BASE}/compatible-mode/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getApiKey()}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown');
    throw new Error(`DashScope VL ${res.status}: ${err}`);
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

export function createDashScopeVLProvider(): AIProvider {
  return {
    id: 'dashscope-vl',
    supports: ['vision-reasoning', 'ocr'] satisfies Capability[],
    chat: (req: ChatRequest) => callDashScopeVL('qwen-vl-max', req),
  };
}
