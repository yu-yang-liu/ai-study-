import { z } from 'zod';
import { HIGH_SUBJECTS } from '../constants';

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '必须使用 YYYY-MM-DD 日期格式');
const highSubject = z.enum(HIGH_SUBJECTS);

export const standardExamRecordSchema = z
  .object({
    rawScore: z.number().finite().nonnegative().optional(),
    rawScoreMin: z.number().finite().nonnegative().optional(),
    rawScoreMax: z.number().finite().nonnegative().optional(),
    rank: z.number().int().positive().optional(),
    percentile: z.number().finite().min(0).max(1).optional(),
    percentileDefinition: z.enum(['above', 'at_or_below']).optional(),
    convertedScore: z.number().finite().min(0).max(100).optional(),
    gradeBand: z.string().min(1).optional(),
    recordType: z.enum(['observed', 'estimated', 'interval']),
    notes: z.string().max(1000).optional(),
  })
  .superRefine((record, ctx) => {
    const hasExactRaw = record.rawScore !== undefined;
    const hasRawInterval = record.rawScoreMin !== undefined || record.rawScoreMax !== undefined;

    if (!hasExactRaw && !hasRawInterval) {
      ctx.addIssue({
        code: 'custom',
        path: ['rawScore'],
        message: '必须提供 rawScore 或 rawScoreMin/rawScoreMax',
      });
    }
    if (hasRawInterval && (record.rawScoreMin === undefined || record.rawScoreMax === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['rawScoreMin'],
        message: '区间记录必须同时提供 rawScoreMin 和 rawScoreMax',
      });
    }
    if (
      record.rawScoreMin !== undefined &&
      record.rawScoreMax !== undefined &&
      record.rawScoreMin > record.rawScoreMax
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['rawScoreMin'],
        message: 'rawScoreMin 不能大于 rawScoreMax',
      });
    }
    if (
      record.rawScore !== undefined &&
      record.rawScoreMin !== undefined &&
      record.rawScore < record.rawScoreMin
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['rawScore'],
        message: 'rawScore 不得小于 rawScoreMin',
      });
    }
    if (
      record.rawScore !== undefined &&
      record.rawScoreMax !== undefined &&
      record.rawScore > record.rawScoreMax
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['rawScore'],
        message: 'rawScore 不得大于 rawScoreMax',
      });
    }
    if (record.percentile !== undefined && record.percentileDefinition === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['percentileDefinition'],
        message: 'percentile 必须明确口径',
      });
    }
    if (record.recordType === 'observed' && record.convertedScore === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['convertedScore'],
        message: 'observed 记录必须提供真实 convertedScore',
      });
    }
    if (record.recordType === 'interval' && record.rawScore === undefined) {
      // Interval records are intentionally allowed to describe a score band.
      return;
    }
    if (record.recordType === 'interval' && record.rawScoreMin === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['rawScoreMin'],
        message: 'interval 记录应提供原始分区间',
      });
    }
  });

export const standardExamMetadataSchema = z.object({
  examId: z.string().min(1),
  examType: z.literal('standard_exam'),
  examStage: z.enum(['合格考', '等级考', '校内考试', '模拟考', '高考']),
  subject: highSubject,
  grade: z.enum(['高一', '高二', '高三']),
  region: z
    .string()
    .min(1)
    .refine((value) => value === '北京' || value.startsWith('北京'), {
      message: '当前系统只接受北京地区数据',
    }),
  examDate: dateString,
  maxRawScore: z.number().finite().positive(),
  maxConvertedScore: z.number().finite().positive().max(100).optional(),
  candidateCount: z.number().int().positive().optional(),
  sourceLevel: z.enum(['A', 'B', 'C']),
  sourceName: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  verificationStatus: z.enum(['pending', 'verified', 'rejected']),
  policyVersion: z.string().min(1).optional(),
});

export const standardExamDatasetSchema = z
  .object({
    schemaVersion: z.literal('beijing-standard-exam.v1'),
    standardExam: standardExamMetadataSchema,
    records: z.array(standardExamRecordSchema).min(1),
  })
  .superRefine((dataset, ctx) => {
    const { standardExam, records } = dataset;
    const exactRawScores = new Set<number>();

    records.forEach((record, index) => {
      if (record.rawScore !== undefined) {
        if (exactRawScores.has(record.rawScore)) {
          ctx.addIssue({
            code: 'custom',
            path: ['records', index, 'rawScore'],
            message: '同一 examId 不允许重复 rawScore 记录',
          });
        }
        exactRawScores.add(record.rawScore);
        if (record.rawScore > standardExam.maxRawScore) {
          ctx.addIssue({
            code: 'custom',
            path: ['records', index, 'rawScore'],
            message: 'rawScore 不得超过 maxRawScore',
          });
        }
      }
      if (record.rawScoreMax !== undefined && record.rawScoreMax > standardExam.maxRawScore) {
        ctx.addIssue({
          code: 'custom',
          path: ['records', index, 'rawScoreMax'],
          message: 'rawScoreMax 不得超过 maxRawScore',
        });
      }
      if (
        record.rank !== undefined &&
        standardExam.candidateCount !== undefined &&
        record.rank > standardExam.candidateCount
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['records', index, 'rank'],
          message: 'rank 不得超过 candidateCount',
        });
      }
    });

    if (standardExam.examStage === '合格考' && standardExam.maxConvertedScore !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['standardExam', 'maxConvertedScore'],
        message: '合格考不应填写等级赋分满分',
      });
    }
    if (standardExam.examStage === '等级考' && standardExam.maxConvertedScore === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['standardExam', 'maxConvertedScore'],
        message: '等级考建议明确 maxConvertedScore',
      });
    }
  });

export const qualificationExamResultSchema = z.object({
  examId: z.string().min(1),
  examType: z.literal('qualification_exam'),
  examStage: z.literal('合格考'),
  subject: highSubject,
  grade: z.enum(['高一', '高二', '高三']),
  region: z
    .string()
    .min(1)
    .refine((value) => value === '北京' || value.startsWith('北京'), {
      message: '当前系统只接受北京地区数据',
    }),
  examDate: dateString,
  result: z.enum(['passed', 'failed']),
  source: z.enum(['official', 'user_reported', 'school_reported']),
});

export const beijingEducationStateSchema = z.object({
  region: z.literal('北京'),
  grade: z.enum(['高一', '高二', '高三']),
  stage: z.enum(['学习阶段', '选科观察', '选科意向', '选科确认', '等级考准备', '高考准备']),
  selection: z.object({
    status: z.enum(['not_started', 'observing', 'intended', 'confirmed']),
    subjects: z.array(highSubject).max(3),
    changedAt: dateString.optional(),
  }),
  qualificationStatus: z
    .partialRecord(highSubject, z.enum(['not_taken', 'passed', 'failed']))
    .default({}),
  subjectPerformance: z
    .partialRecord(
      highSubject,
      z.object({
        rawScore: z.number().finite().nonnegative().optional(),
        maxScore: z.number().finite().positive().optional(),
        percentile: z.number().finite().min(0).max(1).optional(),
        convertedScore: z.number().finite().min(0).max(100).optional(),
        sourceExamId: z.string().min(1).optional(),
        observedAt: dateString.optional(),
      }),
    )
    .default({}),
  policyVersion: z.string().min(1),
  updatedAt: z.string().datetime().optional(),
});

export function isValidConfirmedSelection(subjects: readonly string[]): subjects is string[] {
  const selectionSubjects = new Set(['物理', '化学', '生物', '政治', '历史', '地理']);
  return (
    subjects.length === 3 &&
    new Set(subjects).size === 3 &&
    subjects.every((subject) => selectionSubjects.has(subject))
  );
}
