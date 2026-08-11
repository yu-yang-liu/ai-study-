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
  | 'circuit'
  | 'pedigree'
  | 'graph'
  | 'lab'
  | 'cell';

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
  pedigree: { capability: 'text-reasoning', temperature: 0.1, jsonMode: true },
  graph: { capability: 'text-reasoning', temperature: 0.1, jsonMode: true },
  lab: { capability: 'text-reasoning', temperature: 0.1, jsonMode: true },
  cell: { capability: 'text-reasoning', temperature: 0.1, jsonMode: true },
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
  let text = raw.replace(/^\uFEFF/, '').trim();
  // Strip markdown code fences
  if (text.startsWith('```')) {
    text = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    // Models occasionally prepend a short sentence despite JSON mode.
    // Recover the first balanced object/array without weakening schema validation.
    const start = [...text].findIndex((char) => char === '{' || char === '[');
    if (start < 0) throw error;

    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
      const char = text[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === '{' || char === '[') depth += 1;
      else if (char === '}' || char === ']') {
        depth -= 1;
        if (depth === 0) return JSON.parse(text.slice(start, index + 1));
      }
    }
    throw error;
  }
}
