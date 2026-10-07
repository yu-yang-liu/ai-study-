// Shared helpers for the question-bank seed pipeline.
// Self-contained on purpose: node:sqlite + fetch, no workspace imports,
// so these scripts stay usable while packages/* evolve.
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
// pdf-parse ships CJS; load via require so ESM type-stripped scripts stay simple.
export const pdfParse = require('pdf-parse') as {
  PDFParse: new (opts: { data: Uint8Array }) => { getText(): Promise<{ text: string }>; destroy(): Promise<void> };
};

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const TMP_SEED = join(ROOT, 'tmp', 'seed');
export const EXAM_DIR = join(ROOT, '试卷');

export type Subject = '语文' | '数学' | '英语' | '物理' | '化学' | '生物' | '政治' | '历史' | '地理';

export const SUBJECTS: Subject[] = ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理'];

const SUBJECT_PINYIN: Record<Subject, string> = {
  语文: 'chinese',
  数学: 'math',
  英语: 'english',
  物理: 'physics',
  化学: 'chemistry',
  生物: 'biology',
  政治: 'politics',
  历史: 'history',
  地理: 'geography',
};

export function subjectSlug(subject: Subject): string {
  return SUBJECT_PINYIN[subject];
}

export function subjectFromFileName(fileName: string): Subject | null {
  const hit = SUBJECTS.find((s) => fileName.includes(s));
  return hit ?? null;
}

// --- env -----------------------------------------------------------------

function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[2] !== undefined) out[m[1]!] = m[2]!.replace(/^["']|["']$/g, '');
  }
  return out;
}

let cachedEnv: Record<string, string> | null = null;
function webEnv(): Record<string, string> {
  cachedEnv ??= parseEnvFile(join(ROOT, 'apps', 'web', '.env.local'));
  return cachedEnv;
}

export function getEnv(name: string): string {
  return process.env[name] ?? webEnv()[name] ?? '';
}

/** Same resolution rule as packages/core/src/db/sqlite.ts (app cwd = apps/web). */
export function sqlitePath(): string {
  const configured = getEnv('SQLITE_PATH').trim();
  if (configured) return resolve(configured);
  return join(ROOT, 'apps', 'web', 'data', 'ai-study.sqlite');
}

// --- dashscope embedding ---------------------------------------------------

export function hasEmbeddingKey(): boolean {
  return getEnv('DASHSCOPE_API_KEY').length > 0;
}

const EMBED_BATCH = 10; // text-embedding-v3 batch limit

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const key = getEnv('DASHSCOPE_API_KEY');
  if (!key) throw new Error('Missing DASHSCOPE_API_KEY');
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batch = texts.slice(i, i + EMBED_BATCH);
    const res = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: 'text-embedding-v3', input: { texts: batch } }),
    });
    if (!res.ok) throw new Error(`Embedding ${res.status}: ${(await res.text().catch(() => 'unknown')).slice(0, 200)}`);
    const json = (await res.json()) as { output: { embeddings: Array<{ embedding: number[] }> } };
    vectors.push(...json.output.embeddings.map((e) => e.embedding));
  }
  return vectors;
}

/** Same composition as packages/core/src/learning/ingest-bank.ts embeddingText(). */
export function embeddingText(row: {
  subject: string;
  examPoint?: string | null;
  topic?: string | null;
  content: string;
}): string {
  return [row.subject, row.examPoint, row.topic, row.content].filter(Boolean).join(' ');
}

// --- chat LLM (extraction) -------------------------------------------------

/** Chat completion with JSON output. Tries DeepSeek first, then DashScope
 *  qwen (same key that powers embedding) as a fallback. */
const deadProviders = new Set<string>();

export async function chatJson<T>(messages: Array<{ role: string; content: string }>, maxTokens = 8192): Promise<T> {
  const deepseekKey = getEnv('DEEPSEEK_API_KEY');
  const dashscopeKey = getEnv('DASHSCOPE_API_KEY');
  const providers: Array<{ name: string; key: string; url: string; model: string }> = [];
  if (deepseekKey) providers.push({ name: 'deepseek', key: deepseekKey, url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat' });
  if (dashscopeKey) providers.push({ name: 'dashscope-qwen', key: dashscopeKey, url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model: 'qwen-plus' });
  if (providers.length === 0) throw new Error('No chat LLM key: set DEEPSEEK_API_KEY or DASHSCOPE_API_KEY in apps/web/.env.local');

  let lastErr: unknown = null;
  for (const p of providers) {
    if (deadProviders.has(p.name)) continue;
    try {
      const res = await fetch(p.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}` },
        body: JSON.stringify({
          model: p.model,
          messages,
          response_format: { type: 'json_object' },
          max_tokens: maxTokens,
          temperature: 0.1,
        }),
      });
      if (!res.ok) throw new Error(`${p.name} ${res.status}: ${(await res.text().catch(() => 'unknown')).slice(0, 300)}`);
      const json = (await res.json()) as { choices: Array<{ message: { content: string } }> };
      return JSON.parse(json.choices[0]!.message.content) as T;
    } catch (err) {
      lastErr = err;
      const status = err instanceof Error && / (401|403): /.test(err.message);
      if (status) deadProviders.add(p.name);
      console.warn(`chat provider ${p.name} failed${status ? ' (disabled for this run)' : ''}: ${err instanceof Error ? err.message : err}`);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('all chat providers failed');
}

// --- text helpers -----------------------------------------------------------

/** Read a text file as UTF-8, falling back to GB18030 when U+FFFD shows up. */
export function readTextSmart(path: string): string {
  const buf = readFileSync(path);
  const utf8 = buf.toString('utf8');
  if (!utf8.includes('\uFFFD')) return utf8.replace(/^\uFEFF/, '');
  const decoded = new TextDecoder('gb18030').decode(buf);
  return decoded.replace(/^\uFEFF/, '');
}

export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}

const UUID_V5_NAMESPACE = '6f1f2a4e-9c3b-4b7a-8e2d-1d5c0a9b7f31';

/** Deterministic UUIDv5 from a readable ref (e.g. "bgk2025-math-02").
 *  Same ref → same uuid, so re-imports stay idempotent while satisfying the
 *  API contract (questionId must be a uuid). */
export function refToUuid(ref: string): string {
  const hash = createHash('sha1')
    .update(Buffer.from(UUID_V5_NAMESPACE.replace(/-/g, ''), 'hex'))
    .update(Buffer.from(ref, 'utf8'))
    .digest();
  const bytes = [...hash.slice(0, 16)];
  bytes[6] = ((bytes[6]! & 0x0f) | 0x50) as number;
  bytes[8] = ((bytes[8]! & 0x3f) | 0x80) as number;
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
