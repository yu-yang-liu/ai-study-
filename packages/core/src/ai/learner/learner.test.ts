import { describe, it, expect } from 'vitest';
import { buildLearnerModel } from './model';
import { sm2Update, sm2Defaults } from './sm2';

describe('sm2Update', () => {
  it('resets to interval 1 with quality < 3', () => {
    const result = sm2Update({ easeFactor: 2.5, intervalDays: 30, reviewCount: 5 }, 2);
    expect(result.reviewCount).toBe(0);
    expect(result.intervalDays).toBe(1);
  });

  it('progresses interval with quality >= 3', () => {
    const state = sm2Defaults();
    const r1 = sm2Update(state, 4);
    expect(r1.intervalDays).toBe(1);
    const r2 = sm2Update(r1, 4);
    expect(r2.intervalDays).toBe(6);
    const r3 = sm2Update(r2, 4);
    expect(r3.intervalDays).toBeGreaterThan(6);
  });
});

describe('buildLearnerModel', () => {
  it('returns default on null profiles', () => {
    const model = buildLearnerModel({ userProfiles: null, knowledgeMastery: [] });
    expect(model.dataRichness).toBe(0);
  });

  it('applies forgetting decay while retaining partial mastery and increasing uncertainty', () => {
    const model = buildLearnerModel({
      userProfiles: {
        targetScore: 120,
        weakSubjects: ['数学'],
        strongSubjects: ['英语'],
        abilities: { 计算: 0.3 },
        pace: { avgDailyMinutes: 45, activeHours: [], streakDays: 5 },
        preferences: { explainStyle: '步骤化' },
        dataRichness: 0.6,
      },
      knowledgeMastery: [
        {
          knowledgePoint: '导数',
          level: 0.8,
          uncertainty: 0.2,
          evidenceCount: 10,
          lastSeen: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          trend: 'flat',
        },
      ],
    });
    expect(model.mastery['导数']!.level).toBeGreaterThan(0.5);
    expect(model.mastery['导数']!.level).toBeLessThan(0.8);
    expect(model.mastery['导数']!.uncertainty).toBeGreaterThan(0.2);
  });

  it('aggregates error events into errorProfile', () => {
    const model = buildLearnerModel({
      userProfiles: {
        targetScore: 100,
        weakSubjects: [],
        strongSubjects: [],
        abilities: {},
        pace: {},
        preferences: {},
        dataRichness: 0.5,
      },
      knowledgeMastery: [],
      errorEvents: [
        { errorType: '审题不清' },
        { errorType: '计算失误' },
        { errorType: '审题不清' },
        { errorType: '公式记错' },
        { errorType: '审题不清' },
      ],
    });
    expect(model.errorProfile[0]!.type).toBe('审题不清');
    expect(model.errorProfile[0]!.count).toBe(3);
    expect(model.errorProfile[0]!.recentRate).toBe(3 / 5);
  });
});
