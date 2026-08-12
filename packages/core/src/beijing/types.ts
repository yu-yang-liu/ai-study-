import type { HighSubject } from '../constants';

export type BeijingGrade = '高一' | '高二' | '高三';

export type BeijingExamStage = '合格考' | '等级考' | '校内考试' | '模拟考' | '高考';

export type BeijingExamType = 'practice' | 'qualification_exam' | 'school_exam' | 'standard_exam';

export type StandardExamSourceLevel = 'A' | 'B' | 'C';

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export type StandardExamRecordType = 'observed' | 'estimated' | 'interval';

/** percentile is always normalized to "higher is better" when used by algorithms. */
export type PercentileDefinition = 'above' | 'at_or_below';

export interface StandardExamRecord {
  rawScore?: number;
  rawScoreMin?: number;
  rawScoreMax?: number;
  rank?: number;
  percentile?: number;
  percentileDefinition?: PercentileDefinition;
  convertedScore?: number;
  gradeBand?: string;
  recordType: StandardExamRecordType;
  notes?: string;
}

export interface StandardExamMetadata {
  examId: string;
  examType: 'standard_exam';
  examStage: BeijingExamStage;
  subject: HighSubject;
  grade: BeijingGrade;
  region: string;
  examDate: string;
  maxRawScore: number;
  maxConvertedScore?: number;
  candidateCount?: number;
  sourceLevel: StandardExamSourceLevel;
  sourceName: string;
  sourceUrl?: string;
  verificationStatus: VerificationStatus;
  policyVersion?: string;
}

export interface StandardExamDataset {
  schemaVersion: 'beijing-standard-exam.v1';
  standardExam: StandardExamMetadata;
  records: StandardExamRecord[];
}

export type QualificationStatus = 'not_taken' | 'passed' | 'failed';

export type SelectionStatus = 'not_started' | 'observing' | 'intended' | 'confirmed';

export interface SubjectPerformanceSnapshot {
  rawScore?: number;
  maxScore?: number;
  percentile?: number;
  convertedScore?: number;
  sourceExamId?: string;
  observedAt?: string;
}

/**
 * Beijing education state only records status and evidence. It does not
 * generate proactive subject-selection reminders or university matching.
 */
export interface BeijingEducationState {
  region: '北京';
  grade: BeijingGrade;
  stage: '学习阶段' | '选科观察' | '选科意向' | '选科确认' | '等级考准备' | '高考准备';
  selection: {
    status: SelectionStatus;
    subjects: HighSubject[];
    changedAt?: string;
  };
  qualificationStatus: Partial<Record<HighSubject, QualificationStatus>>;
  subjectPerformance: Partial<Record<HighSubject, SubjectPerformanceSnapshot>>;
  policyVersion: string;
  updatedAt?: string;
}
