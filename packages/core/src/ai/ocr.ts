import { safeFetch, sha256Hash } from '../security';
import { APP_PHASE } from '../constants';
import type { AppPhase } from '../constants';
import { recordApiUsage } from './usage';

// In-memory cache: key = SHA-256 of image URL ? OCR text
const cache = new Map<string, string>();

const DASHSCOPE_BASE = 'https://dashscope.aliyuncs.com';

function getVisionApiKey(): string {
  const key = process.env.DASHSCOPE_VISION_API_KEY || process.env.DASHSCOPE_API_KEY;
  if (!key) throw new Error('Missing DASHSCOPE_VISION_API_KEY or DASHSCOPE_API_KEY');
  return key;
}

interface OCRResult {
  text: string;
  blocks?: Array<{ type: 'text' | 'formula' | 'image'; content: string; confidence?: number }>;
}

/**
 * Runs OCR on an image URL with caching. Cached results are returned instantly.
 */
export async function runOCR(
  imageUrl: string,
  opts?: { userId?: string; phase?: AppPhase },
): Promise<OCRResult> {
  const cacheKey = sha256Hash(imageUrl);

  const cached = cache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const body = {
    model: 'qwen-vl-ocr',
    input: { messages: [{ role: 'user', content: [{ image: imageUrl }, { text: '??????????' }] }] },
  };

  const res = await safeFetch(`${DASHSCOPE_BASE}/compatible-mode/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getVisionApiKey()}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown');
    throw new Error(`OCR failed ${res.status}: ${err}`);
  }

  const json: {
    choices: [{ message: { content: string } }];
    usage?: { prompt_tokens: number; completion_tokens: number };
  } = await res.json();

  const output: OCRResult = { text: json.choices[0]?.message?.content ?? '' };

  cache.set(cacheKey, JSON.stringify(output));

  if (opts?.userId && json.usage) {
    recordApiUsage({
      userId: opts.userId,
      phase: opts.phase ?? APP_PHASE,
      provider: 'dashscope',
      model: 'qwen-vl-ocr',
      task: 'ocr',
      usage: {
        inputTokens: json.usage.prompt_tokens,
        outputTokens: json.usage.completion_tokens,
      },
    });
  }

  return output;
}
