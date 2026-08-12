export type {
  LearnerModel,
  LearnerPace,
  LearnerPreferences,
  LearningEvent,
  KnowledgeMasteryEntry,
} from './types';
export { DEFAULT_LEARNER_MODEL } from './types';
export { buildLearnerModel } from './model';
export { getLearnerContext } from './context';
export { sm2Update, sm2Defaults } from './sm2';
export type { SM2State } from './sm2';
export type {
  MasteryOutcome,
  MasteryState,
  MasteryStateInput,
  MasteryEvidence,
} from '../../learning/mastery-state';
export { updateMasteryState } from '../../learning/mastery-state';
