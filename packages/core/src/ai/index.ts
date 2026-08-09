import { registerProvider, pick } from './gateway/registry';
import { createDeepSeekProvider } from './providers/deepseek';
import { createDashScopeVLProvider } from './providers/dashscope-vl';
import { createEmbeddingProvider } from './providers/embedding';
import { createLocalDistilledProvider } from './providers/local-distilled';
import { structuredCall as _structuredCall } from './structured/call';
import type { EmbeddingResult } from './gateway/types';

let initialized = false;

function ensureProviders() {
  if (initialized) return;
  registerProvider(createDeepSeekProvider());
  registerProvider(createDashScopeVLProvider());
  registerProvider(createEmbeddingProvider());
  registerProvider(createLocalDistilledProvider());
  initialized = true;
}

export { TASK_ROUTING, AIStructuredError, formatZodError, tryParseJson } from './gateway/types';
export type { TaskName, Capability, ChatMessage, ChatRequest, TokenUsage, AIProvider } from './gateway/types';
export { registerProvider, pick, listProviders, getProvider } from './gateway/registry';
export { TASK_SCHEMA } from './structured/schemas';
export * from './structured/schemas';
export { blocksToPlainText } from './structured/blocks';
export { retrieveReferences } from './rag';
export type { RAGReference, RetrieveOptions } from './rag';
export { composePrompt, composeMessages, getPersona, personaSystemPrompt, normalizeSubject, getTaskInstruction, schemaToFormatInstruction } from './prompt';
export type { ComposeOptions } from './prompt';
export { getLearnerContext, buildLearnerModel, sm2Update, sm2Defaults, DEFAULT_LEARNER_MODEL } from './learner';
export type { LearnerModel, LearnerPace, LearnerPreferences, LearningEvent, KnowledgeMasteryEntry, SM2State } from './learner';
export { runOCR } from './ocr';
export { recordApiUsage, queryUserUsage } from './usage';
export { runEval, evalCase, computeDimensions, allSamples, gradeMathSamples, gradeEssaySamples } from './eval';
export type { EvalCase, EvalResult, EvalReport, EvalDimension } from './eval';
export { runChatAgent } from './agent';
export { loadMemory, appendTurn, upsertFact, composeMemoryBlock } from './memory';
export {
  summarizeConversation,
  shouldSummarize,
  composeSummaryBlock,
  splitWindow,
  RAW_WINDOW,
  SUMMARY_TRIGGER,
  loadUserFacts,
  composeUserFactsBlock,
  upsertUserFact,
  forgetUserFact,
  MAX_USER_FACTS,
  storeUserMemory,
  retrieveUserMemory,
  embedUserMemory,
  composeEpisodicBlock,
} from './memory';
export type {
  MemoryContext,
  AgentMemory,
  TurnInput,
  EpisodicMemory,
  MemoryFact,
  UpsertFactResult,
  StoredFact,
  StoreUserMemoryInput,
  UserMemorySource,
} from './memory';

export const structuredCall = _structuredCall;

export async function embedTexts(texts: string[]): Promise<EmbeddingResult> {
  ensureProviders();
  const provider = pick('embedding');
  if (!provider.embed) throw new Error('Selected provider lacks embed capability');
  return provider.embed(texts);
}

/** Auto-bootstraps providers on construction. Use for convenience or test setup. */
export class AIGateway {
  constructor() {
    ensureProviders();
  }
}
