import type { z } from 'zod';

// ── Capability & Task routing ──

export type Capability =
  | 'ocr'
  | 'vision-reasoning'
  | 'text-reasoning'
  | 'fast-text'
  | 'reasoning-heavy'
  | 'embedding';

export type TaskName =
  | 'ocr'
  | 'analyze'
  | 'analyzeImg'
  | 'gradeMath'
  | 'gradeEssay'
  | 'plan'
  | 'chat'
  | 'chatAgent'
  | 'geometry'
  | 'chart'
  | 'circuit';

export interface TaskRoute {
  capability: Capability;
  fallback?: Capability;
  temperature: number;
  jsonMode: boolean;
}

export const TASK_ROUTING: Record<TaskName, TaskRoute> = {
  ocr: { capability: 'ocr', temperature: 0, jsonMode: false },
  analyze: { capability: 'text-reasoning', temperature: 0.3, jsonMode: true },
  analyzeImg: { capability: 'vision-reasoning', temperature: 0.3, jsonMode: true },
  gradeMath: { capability: 'reasoning-heavy', fallback: 'text-reasoning', temperature: 0.1, jsonMode: true },
  gradeEssay: { capability: 'text-reasoning', temperature: 0.3, jsonMode: true },
  plan: { capability: 'text-reasoning', temperature: 0.4, jsonMode: true },
  chat: { capability: 'fast-text', temperature: 0.7, jsonMode: false },
  chatAgent: { capability: 'fast-text', temperature: 0.3, jsonMode: true },
  geometry: { capability: 'text-reasoning', temperature: 0.1, jsonMode: true },
  chart: { capability: 'text-reasoning', temperature: 0.1, jsonMode: true },
  circuit: { capability: 'text-reasoning', temperature: 0.1, jsonMode: true },
};

// ── Provider interface ──

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ChatRequest {
  messages: ChatMessage[];
  temperature?: number;
  jsonMode?: boolean;
  imageUrls?: string[];
  maxTokens?: number;
}

export interface EmbeddingResult {
  vectors: number[][];
  dim: number;
}

export interface AIProvider {
  id: string;
  supports: Capability[];
  chat(req: ChatRequest): Promise<{ content: string; usage?: TokenUsage }>;
  embed?(texts: string[]): Promise<EmbeddingResult>;
}

// ── Structured output ──

export class AIStructuredError extends Error {
  public readonly task: TaskName;
  public readonly zodError: z.ZodError;

  constructor(task: TaskName, zodError: z.ZodError) {
    super(`结构化输出校验失败[${task}]: ${formatZodError(zodError)}`);
    this.name = 'AIStructuredError';
    this.task = task;
    this.zodError = zodError;
  }
}

export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((i) => `${i.path.join('.')}: ${i.message}`)
    .join('; ');
}

export function tryParseJson(raw: string): unknown {
  let text = raw.trim();
  // Strip markdown code fences
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*\n/, '').replace(/\n```\s*$/, '');
  }
  return JSON.parse(text);
}
