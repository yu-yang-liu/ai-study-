export const CORE_VERSION = '0.1.0';
export { APP_PHASE, HIGH_SUBJECTS } from './constants';
export type { AppPhase, HighSubject } from './constants';

// db
export { createAnonClient, createServiceClient, getServiceClient, createDrizzleClient, schema } from './db';
export type { SupabaseClient } from './db';

// auth
export { createServerSupabaseClient, getAuthUser, requireAuth, resolveUserFromAccessToken, isAdmin, requireAdmin, createClientFromToken } from './auth';
export type { AuthUser } from './auth';

// ai
export { AIGateway, structuredCall, embedTexts, retrieveReferences, runOCR, recordApiUsage, queryUserUsage, runEval, evalCase, computeDimensions, allSamples, gradeMathSamples, gradeEssaySamples, geometrySamples, scoreGeometry, geometryOverallScore, geometryCasePassed, GEOMETRY_DIMENSIONS, GEOMETRY_CASE_PASS_THRESHOLD, chartSamples, scoreChart, chartOverallScore, chartCasePassed, CHART_DIMENSIONS, CHART_CASE_PASS_THRESHOLD, circuitSamples, scoreCircuit, circuitOverallScore, circuitCasePassed, CIRCUIT_DIMENSIONS, CIRCUIT_CASE_PASS_THRESHOLD, pedigreeSamples, scorePedigree, pedigreeOverallScore, pedigreeCasePassed, PEDIGREE_DIMENSIONS, PEDIGREE_CASE_PASS_THRESHOLD, graphSamples, scoreGraph, graphOverallScore, graphCasePassed, GRAPH_DIMENSIONS, GRAPH_CASE_PASS_THRESHOLD, evalExpr, composePrompt, composeMessages, getLearnerContext, buildLearnerModel, sm2Update, sm2Defaults, DEFAULT_LEARNER_MODEL, getPersona, personaSystemPrompt, normalizeSubject, getTaskInstruction, schemaToFormatInstruction, GEOMETRY_SYSTEM_PROMPT, GEOMETRY_BLOCK_INSTRUCTION, buildGeometryUserPrompt, CHART_SYSTEM_PROMPT, buildChartUserPrompt, CIRCUIT_SYSTEM_PROMPT, buildCircuitUserPrompt, PEDIGREE_SYSTEM_PROMPT, buildPedigreeUserPrompt, GRAPH_SYSTEM_PROMPT, buildGraphUserPrompt, TASK_ROUTING, TASK_SCHEMA, AIStructuredError, formatZodError, tryParseJson, registerProvider, pick, listProviders, getProvider, runChatAgent, loadMemory, appendTurn, upsertFact, composeMemoryBlock, summarizeConversation, shouldSummarize, composeSummaryBlock, splitWindow, RAW_WINDOW, SUMMARY_TRIGGER, loadUserFacts, composeUserFactsBlock, upsertUserFact, forgetUserFact, MAX_USER_FACTS, storeUserMemory, retrieveUserMemory, embedUserMemory, composeEpisodicBlock } from './ai';
export type { TaskName, Capability, ChatMessage, ChatRequest, TokenUsage, AIProvider, RAGReference, RetrieveOptions, ComposeOptions, LearnerModel, LearnerPace, LearnerPreferences, LearningEvent, KnowledgeMasteryEntry, SM2State, EvalCase, EvalResult, EvalReport, EvalDimension, GeometryEvalCase, GeometryDimension, ChartEvalCase, ChartDimension, CircuitEvalCase, CircuitDimension, PedigreeEvalCase, PedigreeDimension, GraphEvalCase, GraphDimension, LabEvalCase, LabDimension, AnalyzeOutput, ChatOutput, PlanOutput, ChatAgentOutput, ChatAction, ChatAgentResult, MemoryContext, AgentMemory, TurnInput, EpisodicMemory, MemoryFact, UpsertFactResult, StoredFact, StoreUserMemoryInput, UserMemorySource, Block, GeometryAST, GeometryOutput, GeometryElement, ChartBlock, ChartOutput, CircuitBlock, CircuitOutput, PedigreeBlock, PedigreeOutput, GraphBlock, GraphOutput, LabBlock, LabOutput } from './ai';
export { blocksToPlainText } from './ai';

// storage
export { S3Storage, uploadFile, getDownloadUrl, getReadUrl, createPresignedUploadUrl, deleteFile, getS3Config, createS3Client } from './storage';
export type { S3Config, PresignedUpload } from './storage';

// ui
export { Button, Card, Input, Select, Textarea, Spinner, ErrorBanner, SuccessBanner, SubjectPicker, PriorityBadge, ChatBubble, PageTitle, LayoutShell } from './ui/index';

// security
export { safeFetch, assertUserOwnsFile, sha256Hash } from './security';

// rate limit
export { checkRateLimit, rateLimitByKey, checkAIRateLimit, AUTH_RATE_LIMIT, AI_RATE_LIMIT } from './rate-limit';

// content
export { seedAppContent, getContent, listContent, upsertContent, deleteContent } from './content';
export type { ContentRecord } from './content';

export { bootstrapUserRecords, persistAnalyzeResult, persistChatExchange, persistPlanResult, persistGradeResult } from './learning/persist';
export { getAssistantContext } from './learning/assistant-context';
export type { AssistantContextSnapshot } from './learning/assistant-context';
export {
  getOrCreateConversation,
  getOrCreateConversationRow,
  loadConversationMessages,
  listConversations,
} from './learning/conversation';
export type { ConversationMessage, ConversationSummary } from './learning/conversation';
export {
  executeAnalyze,
  executeGrade,
  executePlan,
  fetchWrongQuestionSummary,
  fetchStudySnapshot,
} from './learning/actions';
export type { GradeResult, GradeQuestionType, WrongQuestionSummary, StudySnapshot } from './learning/actions';
export { GRADE_PASS_RATIO } from './learning/actions';
export { fetchStats, fetchWrongQuestionList, submitWrongQuestionReview, FetchNotFoundErr } from './learning/queries';
export type {
  PracticeRow,
  SubjectStats,
  StatsResponse,
  WrongRow,
  WrongQuestionItem,
} from './learning/types';
export {
  updateKnowledgeMastery,
  masteryDelta,
  clampLevel,
  masteryTrend,
  resolveKnowledgePoints,
} from './learning/mastery';
export type { MasteryOutcome } from './learning/mastery';
export { ingestQuestionBankEntries, DEMO_BANK_ENTRIES } from './learning/ingest-bank';
export type { BankEntryInput } from './learning/ingest-bank';
