import type { AIProvider, Capability, ChatRequest, TokenUsage } from '../gateway/types';

const OLLAMA_BASE = process.env.OLLAMA_HOST ?? 'http://localhost:11434';

/** 默认模型：可通过 OLLAMA_MODEL 环境变量覆盖 */
const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? 'qwen2.5:7b';

interface OllamaResponse {
  message: { role: string; content: string };
  done: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
}

async function callOllama(
  model: string,
  req: ChatRequest,
): Promise<{ content: string; usage?: TokenUsage }> {
  const systemMsg = req.messages.find((m) => m.role === 'system');
  const userMsgs = req.messages.filter((m) => m.role === 'user' || m.role === 'assistant');

  const body: Record<string, unknown> = {
    model,
    messages: userMsgs.map((m) => ({ role: m.role, content: m.content })),
    stream: false,
    options: {
      temperature: req.temperature ?? 0.7,
      num_predict: req.maxTokens ?? 2048,
    },
  };

  if (systemMsg) {
    body.system = systemMsg.content;
  }

  if (req.jsonMode) {
    body.format = 'json';
  }

  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown');
    throw new Error(`Ollama ${res.status}: ${err}`);
  }

  const json: OllamaResponse = await res.json();

  return {
    content: json.message?.content ?? '',
    usage:
      json.prompt_eval_count !== undefined && json.eval_count !== undefined
        ? { inputTokens: json.prompt_eval_count, outputTokens: json.eval_count }
        : undefined,
  };
}

export function createLocalDistilledProvider(): AIProvider {
  const model = DEFAULT_MODEL;

  return {
    id: 'local-distilled',
    supports: ['fast-text'] satisfies Capability[],
    chat: (req: ChatRequest) => callOllama(model, req),
  };
}
