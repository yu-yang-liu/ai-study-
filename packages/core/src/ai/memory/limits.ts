export const MEMORY_FACT_KEY_MAX_CHARS = 64;
export const MEMORY_FACT_VALUE_MAX_CHARS = 300;
export const MEMORY_FACT_CATEGORY_MAX_CHARS = 32;
export const MEMORY_FACT_CONTEXT_MAX_CHARS = 2400;

export const EPISODIC_MEMORY_CONTENT_MAX_CHARS = 1800;
export const EPISODIC_MEMORY_ITEM_MAX_CHARS = 600;
export const EPISODIC_MEMORY_CONTEXT_MAX_CHARS = 2400;
export const EPISODIC_MEMORY_MAX_RETRIEVAL = 5;

export const SUMMARY_MAX_CHARS = 1200;
export const SUMMARY_INPUT_MAX_CHARS = 24000;
export const SUMMARY_MESSAGE_MAX_CHARS = 1200;
export const EMBEDDING_DIMENSIONS = 1024;

export function compactMemoryText(value: string, maxChars: number): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);
}

export function clampMemoryScore(value: number, fallback = 0.6): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

export function clampMemoryLimit(value: number, fallback = 3): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(EPISODIC_MEMORY_MAX_RETRIEVAL, Math.max(1, Math.floor(value)));
}
