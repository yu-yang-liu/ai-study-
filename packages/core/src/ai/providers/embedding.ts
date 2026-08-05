import { safeFetch } from '../../security';
import type { AIProvider, Capability, EmbeddingResult } from '../gateway/types';

const DASHSCOPE_BASE = 'https://dashscope.aliyuncs.com';
const EMBEDDING_DIM = 1024;

function getApiKey(): string {
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key) throw new Error('Missing DASHSCOPE_API_KEY');
  return key;
}

export function createEmbeddingProvider(): AIProvider & { embed(texts: string[]): Promise<EmbeddingResult> } {
  return {
    id: 'dashscope-embedding',
    supports: ['embedding'] satisfies Capability[],
    async chat() {
      throw new Error('Embedding provider does not support chat');
    },
    async embed(texts: string[]): Promise<EmbeddingResult> {
      if (texts.length === 0) return { vectors: [], dim: EMBEDDING_DIM };

      const res = await safeFetch(`${DASHSCOPE_BASE}/compatible-mode/v1/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getApiKey()}` },
        body: JSON.stringify({
          model: 'text-embedding-v3',
          input: { texts },
        }),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => 'unknown');
        throw new Error(`Embedding ${res.status}: ${err}`);
      }

      const json: { output: { embeddings: Array<{ embedding: number[] }> } } = await res.json();
      const vectors = json.output.embeddings.map((e) => e.embedding);
      const dim = vectors[0]?.length ?? EMBEDDING_DIM;

      return { vectors, dim };
    },
  };
}
