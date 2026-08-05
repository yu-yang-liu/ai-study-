import { createServiceClient } from '../db';
import type { AppPhase } from '../constants';
import type { TokenUsage } from './gateway/types';

interface RecordOptions {
  userId: string;
  phase: AppPhase;
  provider: string;
  model: string;
  task: string;
  usage: TokenUsage;
}

const PRICING: Record<string, { input: number; output: number }> = {
  // DeepSeek
  'deepseek-chat': { input: 0.001, output: 0.002 },
  'deepseek-reasoner': { input: 0.004, output: 0.016 },
  // DashScope (????
  'qwen-vl-max': { input: 0.005, output: 0.015 },
  'qwen-vl-ocr': { input: 0.003, output: 0.009 },
  // Embedding
  'text-embedding-v3': { input: 0.0004, output: 0 },
  // Ollama ?????? GPU ??????????
  'qwen2.5:7b': { input: 0.0001, output: 0.0001 },
  'deepseek-r1:8b': { input: 0.0001, output: 0.0001 },
};

function calcCost(model: string, usage: TokenUsage): number {
  const price = PRICING[model] ?? { input: 0, output: 0 };
  return (usage.inputTokens / 1000) * price.input + (usage.outputTokens / 1000) * price.output;
}

const MAX_RETRIES = parseInt(process.env.API_USAGE_RECORD_MAX_RETRIES ?? '3', 10);

async function insertWithRetry(supabase: ReturnType<typeof createServiceClient>, row: Record<string, unknown>, attempt = 1): Promise<void> {
  const { error } = await supabase.from('api_usage').insert(row);

  if (!error) return;

  if (attempt < MAX_RETRIES) {
    const delayMs = Math.min(100 * 2 ** (attempt - 1), 2000); // exponential backoff with 2s cap
    await new Promise((r) => setTimeout(r, delayMs));
    return insertWithRetry(supabase, row, attempt + 1);
  }

  throw new Error(`recordApiUsage failed after ${MAX_RETRIES} retries: ${error.message}`);
}

export async function recordApiUsage(opts: RecordOptions): Promise<void> {
  if (!opts.userId) return;
  const cost = calcCost(opts.model, opts.usage);

  const supabase = createServiceClient();

  await insertWithRetry(supabase, {
    user_id: opts.userId,
    phase: opts.phase,
    provider: opts.provider,
    model: opts.model,
    task: opts.task,
    input_tokens: opts.usage.inputTokens,
    output_tokens: opts.usage.outputTokens,
    cost,
  });
}

export async function queryUserUsage(userId: string): Promise<{ totalCost: number; calls: number }> {
  const supabase = createServiceClient();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data, error } = await supabase
    .from('api_usage')
    .select('cost')
    .eq('user_id', userId)
    .gte('created_at', startOfMonth);

  if (error) throw new Error(`queryUserUsage failed: ${error.message}`);

  const rows = data ?? [];
  const totalCost = rows.reduce((sum: number, r: { cost: number }) => sum + Number(r.cost), 0);
  return { totalCost, calls: rows.length };
}
