import { describe, expect, it } from 'vitest';
import { standardExamDatasetSchema } from './schema';
import { calibratePercentile, calibrateRawScore } from './calibration';

const dataset = standardExamDatasetSchema.parse({
  schemaVersion: 'beijing-standard-exam.v1',
  standardExam: {
    examId: 'bj-2026-03-physics',
    examType: 'standard_exam',
    examStage: '等级考',
    subject: '物理',
    grade: '高三',
    region: '北京',
    examDate: '2026-03-15',
    maxRawScore: 100,
    maxConvertedScore: 100,
    candidateCount: 10000,
    sourceLevel: 'A',
    sourceName: 'official sample',
    verificationStatus: 'verified',
  },
  records: [
    {
      rawScore: 60,
      percentile: 0.5,
      percentileDefinition: 'above',
      convertedScore: 60,
      recordType: 'observed',
    },
    {
      rawScore: 80,
      percentile: 0.8,
      percentileDefinition: 'above',
      convertedScore: 80,
      recordType: 'observed',
    },
    {
      rawScore: 90,
      percentile: 0.95,
      percentileDefinition: 'above',
      convertedScore: 90,
      recordType: 'observed',
    },
    {
      rawScore: 75,
      percentile: 0.7,
      percentileDefinition: 'above',
      convertedScore: 73,
      recordType: 'estimated',
    },
  ],
});

describe('Beijing standard exam calibration', () => {
  it('uses observed exact anchors without consulting estimated records', () => {
    const result = calibrateRawScore(dataset, 80);
    expect(result.method).toBe('exact_observed');
    expect(result.predictedConvertedScore).toBe(80);
    expect(result.confidence).toBe(1);
  });

  it('interpolates only inside observed anchor range', () => {
    const result = calibrateRawScore(dataset, 70);
    expect(result.method).toBe('interpolated');
    expect(result.predictedConvertedScore).toBe(70);
    expect(result.interval).toEqual([60, 80]);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('does not extrapolate outside the observed range', () => {
    const result = calibrateRawScore(dataset, 95);
    expect(result.method).toBe('unavailable');
    expect(result.reason).toBe('outside_observed_range');
  });

  it('normalizes at_or_below percentile to higher-is-better', () => {
    const atOrBelowDataset = standardExamDatasetSchema.parse({
      ...dataset,
      records: dataset.records.map((record) => ({
        ...record,
        percentileDefinition: 'at_or_below' as const,
        percentile: record.percentile === undefined ? undefined : 1 - record.percentile,
      })),
    });
    const result = calibratePercentile(atOrBelowDataset, 0.8);
    expect(result.method).toBe('exact_observed');
    expect(result.predictedConvertedScore).toBe(80);
  });
});
