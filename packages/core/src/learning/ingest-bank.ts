import { getServiceClient } from '../db';
import { APP_PHASE } from '../constants';
import { embedTexts } from '../ai';

export type BankEntryInput = {
  subject: string;
  content: string;
  examPoint?: string;
  analysis?: string;
  answer?: string;
  questionType?: string;
  topic?: string;
  source?: string;
  difficulty?: number;
};

function embeddingText(entry: BankEntryInput): string {
  return [entry.subject, entry.examPoint, entry.topic, entry.content].filter(Boolean).join(' ');
}

/** Insert question_bank rows with DashScope embeddings (batch). */
export async function ingestQuestionBankEntries(
  entries: BankEntryInput[],
): Promise<{ inserted: number }> {
  if (entries.length === 0) return { inserted: 0 };

  const texts = entries.map(embeddingText);
  const { vectors } = await embedTexts(texts);
  const supabase = getServiceClient();

  const rows = entries.map((entry, i) => ({
    phase: APP_PHASE,
    subject: entry.subject,
    topic: entry.topic ?? null,
    exam_point: entry.examPoint ?? null,
    question_type: entry.questionType ?? null,
    content: entry.content,
    answer: entry.answer ?? null,
    analysis: entry.analysis ?? null,
    source: entry.source ?? 'ingest',
    difficulty: entry.difficulty ?? null,
    embedding: `[${vectors[i]!.join(',')}]`,
  }));

  const { error } = await supabase.from('question_bank').insert(rows);
  if (error) throw new Error(`ingestQuestionBankEntries: ${error.message}`);

  return { inserted: rows.length };
}

/** Dev/demo seed entries. */
export const DEMO_BANK_ENTRIES: BankEntryInput[] = [
  {
    subject: '数学',
    topic: '函数',
    examPoint: '二次函数最值',
    questionType: '计算题',
    content: '已知函数 f(x)=x²-4x+3，求 f(x) 在区间 [0,4] 上的最小值。',
    answer: '最小值为 -1，在 x=2 处取得。',
    analysis: '配方得 f(x)=(x-2)²-1，顶点在 x=2，落在区间内。',
    difficulty: 4,
    source: 'demo-seed',
  },
  {
    subject: '数学',
    topic: '导数',
    examPoint: '导数几何意义',
    questionType: '简答题',
    content: '简述导数 f\'(x₀) 的几何意义。',
    answer: '曲线 y=f(x) 在点 (x₀,f(x₀)) 处切线的斜率。',
    analysis: '导数定义与切线斜率一致，是高考常见概念题。',
    difficulty: 3,
    source: 'demo-seed',
  },
  {
    subject: '英语',
    topic: '语法',
    examPoint: '定语从句',
    questionType: '选择题',
    content: 'The book ___ I borrowed from the library is very interesting.',
    answer: 'which/that',
    analysis: '先行词 book 在从句中作 borrowed 的宾语，用 which 或 that。',
    difficulty: 3,
    source: 'demo-seed',
  },
];
