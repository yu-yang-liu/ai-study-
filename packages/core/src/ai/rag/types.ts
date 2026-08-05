/** RAG retrieval result � only exam_points and scoring criteria, never raw question text. */
import type { AppPhase } from '../../constants';

export interface RAGReference {
  examPoint: string;
  analysis: string;
  questionType: string;
  similarity: number;
}

export interface RetrieveOptions {
  query: string;
  subject: string;
  phase: AppPhase;
  limit?: number; // default 5, returned after rerank ?3
  minScore?: number; // default 0.78
}

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<{ vectors: number[][]; dim: number }>;
}
