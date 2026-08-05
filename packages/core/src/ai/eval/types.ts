import type { TaskName, ChatMessage } from '../gateway/types';

export interface EvalDimension {
  name: string;
  weight: number;
  score: number;
}

export interface EvalCase {
  id: string;
  task: TaskName;
  messages: ChatMessage[];
  expected: Record<string, unknown>;
  tolerances?: Record<string, number>;
}

export interface EvalResult {
  caseId: string;
  task: TaskName;
  overallScore: number;
  dimensions: EvalDimension[];
  output: unknown;
  expected: unknown;
  passed: boolean;
  durationMs: number;
}

export interface EvalReport {
  task: TaskName;
  totalCases: number;
  passed: number;
  failed: number;
  averageScore: number;
  cases: EvalResult[];
}
