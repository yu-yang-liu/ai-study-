import { describe, expect, it } from 'vitest';
import {
  beijingEducationStateSchema,
  isValidConfirmedSelection,
  standardExamDatasetSchema,
} from './schema';

describe('Beijing standard exam schemas', () => {
  it('rejects non-Beijing datasets and ambiguous percentiles', () => {
    const result = standardExamDatasetSchema.safeParse({
      schemaVersion: 'beijing-standard-exam.v1',
      standardExam: {
        examId: 'x',
        examType: 'standard_exam',
        examStage: '等级考',
        subject: '物理',
        grade: '高三',
        region: '上海',
        examDate: '2026-03-15',
        maxRawScore: 100,
        sourceLevel: 'C',
        sourceName: 'sample',
        verificationStatus: 'pending',
      },
      records: [{ rawScore: 70, percentile: 0.7, convertedScore: 70, recordType: 'observed' }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts a qualification status without creating a converted score', () => {
    const result = beijingEducationStateSchema.parse({
      region: '北京',
      grade: '高一',
      stage: '选科观察',
      selection: { status: 'observing', subjects: [] },
      qualificationStatus: { 物理: 'passed' },
      subjectPerformance: {},
      policyVersion: 'beijing-gaokao-2026',
    });
    expect(result.qualificationStatus['物理']).toBe('passed');
  });

  it('validates confirmed selection as exactly three of the six selection subjects', () => {
    expect(isValidConfirmedSelection(['物理', '化学', '生物'])).toBe(true);
    expect(isValidConfirmedSelection(['语文', '物理', '化学'])).toBe(false);
    expect(isValidConfirmedSelection(['物理', '化学'])).toBe(false);
    expect(isValidConfirmedSelection(['物理', '化学', '化学'])).toBe(false);
  });
});
