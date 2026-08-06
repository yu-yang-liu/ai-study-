import { z } from 'zod';
import type { TaskName } from '../gateway/types';

export const knowledgePointSchema = z.string().min(1);
export const subjectSchema = z.enum([
  '语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理',
]);

export const ocrOutput = z.object({
  text: z.string(),
  blocks: z.array(z.object({
    type: z.enum(['text', 'formula', 'image']),
    content: z.string(),
    confidence: z.number().min(0).max(1).optional(),
  })).optional(),
});
export type OcrOutput = z.infer<typeof ocrOutput>;

export const analyzeOutput = z.object({
  subject: subjectSchema,
  questionType: z.enum(['选择题', '填空题', '简答题', '计算题', '证明题', '作文']),
  knowledgePoints: z.array(knowledgePointSchema),
  difficulty: z.number().int().min(1).max(10),
  answer: z.string().optional(),
  analysis: z.string(),
  examPoints: z.string().optional(),
});
export type AnalyzeOutput = z.infer<typeof analyzeOutput>;

export const gradeMathOutput = z.object({
  score: z.number().min(0),
  maxScore: z.number().min(1).default(100),
  isCorrect: z.boolean(),
  steps: z.array(z.object({
    stepNumber: z.number().int(),
    isCorrect: z.boolean(),
    feedback: z.string(),
  })),
  summary: z.string(),
});
export type GradeMathOutput = z.infer<typeof gradeMathOutput>;

export const gradeEssayOutput = z.object({
  score: z.number().min(0),
  maxScore: z.number().min(1).default(60),
  dimensions: z.record(z.string(), z.number().min(0)),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  summary: z.string(),
});
export type GradeEssayOutput = z.infer<typeof gradeEssayOutput>;

export const planOutput = z.object({
  title: z.string(),
  description: z.string(),
  tasks: z.array(z.object({
    title: z.string(),
    subject: subjectSchema,
    knowledgePoints: z.array(knowledgePointSchema),
    estimatedMinutes: z.number().int().min(1),
    priority: z.enum(['高', '中', '低']),
    reason: z.string(),
  })),
  createdAt: z.string().optional(),
});
export type PlanOutput = z.infer<typeof planOutput>;

export const chatOutput = z.object({ reply: z.string() });
export type ChatOutput = z.infer<typeof chatOutput>;

export const chatAgentToolName = z.enum([
  'generate_plan',
  'analyze_question',
  'grade_submission',
  'summarize_wrong_questions',
  'remember_fact',
  'forget_fact',
]);

export const chatAgentOutput = z.object({
  reply: z.string().optional(),
  tool: z
    .object({
      name: chatAgentToolName,
      args: z.record(z.string(), z.unknown()).default({}),
    })
    .optional(),
});
export type ChatAgentOutput = z.infer<typeof chatAgentOutput>;

export type ChatActionType = 'plan' | 'analyze' | 'grade' | 'wrong_questions';

export interface ChatAction {
  type: ChatActionType;
  payload: Record<string, unknown>;
}

export interface ChatAgentResult {
  reply: string;
  action?: ChatAction;
}

export const TASK_SCHEMA: Record<TaskName, z.ZodType<unknown>> = {
  ocr: ocrOutput,
  analyze: analyzeOutput,
  analyzeImg: analyzeOutput,
  gradeMath: gradeMathOutput,
  gradeEssay: gradeEssayOutput,
  plan: planOutput,
  chat: chatOutput,
  chatAgent: chatAgentOutput,
};
