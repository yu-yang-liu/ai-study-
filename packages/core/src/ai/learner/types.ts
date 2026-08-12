import type { AppPhase } from '../../constants';
import type { BeijingEducationState } from '../../beijing';

export interface KnowledgeMasteryEntry {
  knowledgePoint: string;
  level: number;
  uncertainty: number;
  evidenceCount: number;
  lastSeen: string;
  trend: 'up' | 'flat' | 'down';
}

export interface ErrorProfile {
  type: string;
  count: number;
  recentRate: number;
}

export interface LearnerPace {
  avgDailyMinutes: number;
  activeHours: number[];
  streakDays: number;
}

export interface LearnerPreferences {
  explainStyle?: '简洁' | '详细' | '步骤化';
  preferredDifficulty?: number;
}

export interface LearnerModel {
  mastery: Record<string, KnowledgeMasteryEntry>;
  abilities: Record<'理解' | '表达' | '推理' | '计算' | '应用', number>;
  errorProfile: ErrorProfile[];
  weakSubjects: string[];
  strongSubjects: string[];
  pace: LearnerPace;
  preferences: LearnerPreferences;
  targetScore?: number;
  dataRichness: number;
  educationState?: BeijingEducationState;
}

export interface LearningEvent {
  userId: string;
  phase: AppPhase;
  type: 'analyze' | 'grade' | 'practice' | 'chat' | 'plan_followed' | 'review';
  subject: string;
  knowledgePoints: string[];
  isCorrect?: boolean;
  score?: number;
  maxScore?: number;
  difficulty?: number;
  errorType?: string;
  abilityAssessment?: Record<string, '强' | '中' | '弱'>;
  durationSec?: number;
  createdAt: string;
}

export const DEFAULT_LEARNER_MODEL: LearnerModel = {
  mastery: {},
  abilities: { 理解: 0.5, 表达: 0.5, 推理: 0.5, 计算: 0.5, 应用: 0.5 },
  errorProfile: [],
  weakSubjects: [],
  strongSubjects: [],
  pace: { avgDailyMinutes: 0, activeHours: [], streakDays: 0 },
  preferences: {},
  dataRichness: 0,
};
