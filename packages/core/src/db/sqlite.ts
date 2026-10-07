import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Local persistence for the self-hosted edition of ai-study.
 *
 * The public API intentionally resembles the small part of the Supabase query
 * API used by the application. Keeping that boundary here lets the learning
 * layer stay focused on business logic while the project runs without a cloud
 * database, RLS, pgvector, or a Supabase account.
 */

const JSON_COLUMNS = new Set([
  'ability_assessment',
  'abilities',
  'data',
  'embedding',
  'image_urls',
  'knowledge_points',
  'metadata',
  'options',
  'pace',
  'plan_data',
  'preferences',
  'qualification_status',
  'rag_context',
  'raw_payload',
  'selected_subjects',
  'subject_performance',
  'strong_subjects',
  'weak_subjects',
]);

const BOOLEAN_COLUMNS = new Set([
  'active',
  'email_confirmed',
  'is_correct',
  'is_favorite',
  'mastered',
  'revoked',
]);

const TABLES = new Set([
  'api_usage',
  'app_content',
  'beijing_education_states',
  'conversation_messages',
  'conversation_summaries',
  'conversations',
  'knowledge_mastery',
  'learning_events',
  'practice_records',
  'profiles',
  'question_analysis',
  'question_bank',
  'questions',
  'sessions',
  'standard_exam_records',
  'standard_exams',
  'study_plans',
  'user_memory_facts',
  'user_memories',
  'user_profiles',
  'users',
  'wrong_questions',
]);

const SQLITE_SCHEMA = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  access_token TEXT PRIMARY KEY,
  refresh_token TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  refresh_expires_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  phase TEXT NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT,
  grade TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS learning_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  type TEXT NOT NULL,
  subject TEXT NOT NULL,
  knowledge_points TEXT NOT NULL DEFAULT '[]',
  is_correct INTEGER,
  score REAL,
  max_score REAL,
  difficulty INTEGER,
  error_type TEXT,
  ability_assessment TEXT,
  duration_sec INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_learning_events_user_created ON learning_events(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  image_urls TEXT NOT NULL DEFAULT '[]',
  source TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS question_analysis (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  topic TEXT,
  question_type TEXT,
  knowledge_points TEXT NOT NULL DEFAULT '[]',
  difficulty INTEGER,
  answer TEXT,
  analysis TEXT,
  exam_points TEXT,
  rag_context TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_question_analysis_favorite ON question_analysis(user_id, phase, is_favorite);

CREATE TABLE IF NOT EXISTS practice_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  is_correct INTEGER NOT NULL,
  score REAL,
  max_score REAL DEFAULT 100,
  user_answer TEXT,
  ai_feedback TEXT,
  error_type TEXT,
  duration_sec INTEGER,
  client_request_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, client_request_id)
);

CREATE TABLE IF NOT EXISTS wrong_questions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  knowledge_points TEXT NOT NULL DEFAULT '[]',
  error_type TEXT,
  review_count INTEGER NOT NULL DEFAULT 0,
  ease_factor REAL NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 1,
  next_review_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  mastered INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_wrong_questions_next_review ON wrong_questions(user_id, next_review_at);

CREATE TABLE IF NOT EXISTS knowledge_mastery (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  knowledge_point TEXT NOT NULL,
  subject TEXT NOT NULL,
  level REAL NOT NULL DEFAULT 0,
  uncertainty REAL NOT NULL DEFAULT 1,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  mastery_version TEXT NOT NULL DEFAULT 'legacy-v1',
  last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  trend TEXT NOT NULL DEFAULT 'flat',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, phase, knowledge_point)
);

CREATE TABLE IF NOT EXISTS study_plans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  plan_data TEXT NOT NULL DEFAULT '{}',
  starts_at TEXT,
  ends_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '新对话',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation ON conversation_messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS conversation_summaries (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL UNIQUE REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  summary_up_to TEXT NOT NULL,
  summary_up_to_message_id TEXT,
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  phase TEXT NOT NULL,
  target_score REAL,
  weak_subjects TEXT NOT NULL DEFAULT '[]',
  strong_subjects TEXT NOT NULL DEFAULT '[]',
  abilities TEXT NOT NULL DEFAULT '{}',
  pace TEXT NOT NULL DEFAULT '{}',
  preferences TEXT NOT NULL DEFAULT '{}',
  data_richness REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS api_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  task TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_content (
  id TEXT PRIMARY KEY,
  phase TEXT NOT NULL,
  subject TEXT NOT NULL,
  content_type TEXT NOT NULL,
  title TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(phase, subject, content_type)
);

CREATE TABLE IF NOT EXISTS question_bank (
  id TEXT PRIMARY KEY,
  phase TEXT NOT NULL,
  subject TEXT NOT NULL,
  year INTEGER,
  topic TEXT,
  exam_point TEXT,
  question_type TEXT,
  content TEXT NOT NULL,
  options TEXT,
  answer TEXT,
  analysis TEXT,
  source TEXT,
  difficulty INTEGER,
  embedding TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_question_bank_phase_subject ON question_bank(phase, subject);
CREATE INDEX IF NOT EXISTS idx_question_bank_phase_year ON question_bank(phase, year);

CREATE TABLE IF NOT EXISTS user_memory_facts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  category TEXT,
  source_conversation_id TEXT,
  phase TEXT NOT NULL DEFAULT 'high',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, key)
);

CREATE TABLE IF NOT EXISTS user_memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  phase TEXT NOT NULL DEFAULT 'high',
  source TEXT NOT NULL,
  subject TEXT,
  content TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  embedding TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_memories_user_phase_created ON user_memories(user_id, phase, created_at DESC);

CREATE TABLE IF NOT EXISTS standard_exams (
  exam_id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL,
  exam_type TEXT NOT NULL DEFAULT 'standard_exam',
  exam_stage TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade TEXT NOT NULL,
  region TEXT NOT NULL,
  exam_date TEXT NOT NULL,
  max_raw_score REAL NOT NULL,
  max_converted_score REAL,
  candidate_count INTEGER,
  source_level TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  policy_version TEXT,
  raw_payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS standard_exam_records (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES standard_exams(exam_id) ON DELETE CASCADE,
  record_key TEXT NOT NULL,
  raw_score REAL,
  raw_score_min REAL,
  raw_score_max REAL,
  rank INTEGER,
  percentile REAL,
  percentile_definition TEXT,
  converted_score REAL,
  grade_band TEXT,
  record_type TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(exam_id, record_key)
);

CREATE TABLE IF NOT EXISTS beijing_education_states (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  region TEXT NOT NULL DEFAULT '北京',
  grade TEXT NOT NULL,
  stage TEXT NOT NULL,
  selection_status TEXT NOT NULL DEFAULT 'not_started',
  selected_subjects TEXT NOT NULL DEFAULT '[]',
  selection_changed_at TEXT,
  qualification_status TEXT NOT NULL DEFAULT '{}',
  subject_performance TEXT NOT NULL DEFAULT '{}',
  policy_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

type SqlRow = Record<string, unknown>;
type SQLiteValue = string | number | bigint | null | Uint8Array;
type Filter = { column: string; operator: string; value: unknown };
type SelectNode = { field: string; children?: SelectNode[] };

export type LocalError = { message: string };
export type LocalResult = { data: any; error: LocalError | null; count: number | null };

function nowIso(): string {
  return new Date().toISOString();
}

function quoteIdentifier(value: string): string {
  if (!/^[a-z_][a-z0-9_]*$/u.test(value)) throw new Error(`Invalid SQLite identifier: ${value}`);
  return `"${value}"`;
}

function assertTable(table: string): void {
  if (!TABLES.has(table)) throw new Error(`Unknown local table: ${table}`);
}

function splitTopLevel(input: string): string[] {
  const result: string[] = [];
  let start = 0;
  let depth = 0;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (char === ',' && depth === 0) {
      result.push(input.slice(start, i).trim());
      start = i + 1;
    }
  }
  const tail = input.slice(start).trim();
  if (tail) result.push(tail);
  return result;
}

function parseSelect(input: string | undefined): SelectNode[] {
  const value = input?.trim() || '*';
  if (value === '*') return [{ field: '*' }];
  return splitTopLevel(value).map((part) => {
    const open = part.indexOf('(');
    if (open < 0 || !part.endsWith(')')) return { field: part.trim() };
    return {
      field: part.slice(0, open).trim(),
      children: parseSelect(part.slice(open + 1, -1)),
    };
  });
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function encodeValue(column: string, value: unknown): SQLiteValue {
  if (value === undefined) return null;
  if (value === null) return null;
  if (BOOLEAN_COLUMNS.has(column) && typeof value === 'boolean') return value ? 1 : 0;
  if (JSON_COLUMNS.has(column) && (Array.isArray(value) || typeof value === 'object')) {
    return JSON.stringify(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' || value instanceof Uint8Array) {
    return value;
  }
  return String(value);
}

function decodeValue(column: string, value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (BOOLEAN_COLUMNS.has(column)) return Boolean(value);
  if (JSON_COLUMNS.has(column) && column !== 'embedding') return parseJson(value);
  return value;
}

function decodeRow(row: SqlRow): SqlRow {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, decodeValue(key, value)]));
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left == null || right == null) return left == null && right == null;
  return String(left) === String(right);
}

function compareValues(left: unknown, right: unknown): number {
  if (left == null && right == null) return 0;
  if (left == null) return -1;
  if (right == null) return 1;
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
  return String(left).localeCompare(String(right), 'zh-CN', { numeric: true });
}

function vectorFromValue(value: unknown): number[] | null {
  if (Array.isArray(value) && value.every((item) => typeof item === 'number')) return value;
  if (typeof value !== 'string') return null;
  const parsed = parseJson(value);
  if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'number')) return parsed;
  const trimmed = value.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return null;
  const numbers = trimmed
    .slice(1, -1)
    .split(',')
    .map(Number);
  return numbers.length > 0 && numbers.every(Number.isFinite) ? numbers : null;
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let i = 0; i < left.length; i += 1) {
    dot += left[i]! * right[i]!;
    leftNorm += left[i]! ** 2;
    rightNorm += right[i]! ** 2;
  }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : 0;
}

function parseComparison(input: string): Filter | null {
  const match = input.match(/^([a-z_][a-z0-9_]*)\.(eq|gt|gte|lt|lte|neq)\.(.*)$/u);
  if (!match) return null;
  const [, column, operator, rawValue] = match;
  return { column: column!, operator: operator!, value: rawValue };
}

function matchesFilter(row: SqlRow, filter: Filter): boolean {
  const actual = row[filter.column];
  // 布尔列以 0/1 存储：比较前先把布尔过滤值编码为 1/0，与 SQL 路径语义一致。
  const filterValue =
    BOOLEAN_COLUMNS.has(filter.column) && typeof filter.value === 'boolean' ? (filter.value ? 1 : 0) : filter.value;
  switch (filter.operator) {
    case 'eq':
      return valuesEqual(actual, filterValue);
    case 'neq':
      return !valuesEqual(actual, filterValue);
    case 'gt':
      return compareValues(actual, filterValue) > 0;
    case 'gte':
      return compareValues(actual, filterValue) >= 0;
    case 'lt':
      return compareValues(actual, filterValue) < 0;
    case 'lte':
      return compareValues(actual, filterValue) <= 0;
    case 'is':
      return filterValue === null ? actual == null : valuesEqual(actual, filterValue);
    default:
      return false;
  }
}

function splitOrExpression(input: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < input.length; i += 1) {
    if (input[i] === '(') depth += 1;
    else if (input[i] === ')') depth -= 1;
    else if (input[i] === ',' && depth === 0) {
      result.push(input.slice(start, i));
      start = i + 1;
    }
  }
  result.push(input.slice(start));
  return result.map((part) => part.trim()).filter(Boolean);
}

function matchesOr(row: SqlRow, expression: string): boolean {
  return splitOrExpression(expression).some((part) => {
    if (part.startsWith('and(') && part.endsWith(')')) {
      return splitOrExpression(part.slice(4, -1)).every((condition) => {
        const filter = parseComparison(condition);
        return filter ? matchesFilter(row, filter) : false;
      });
    }
    const filter = parseComparison(part);
    return filter ? matchesFilter(row, filter) : false;
  });
}

// ── WHERE 编译（仅过滤条件进入 SQL；排序/分页/count/投影保持 JS 实现） ──

const NOT_ENCODABLE = Symbol('not-encodable');

const COMPARISON_SQL: Record<string, string> = {
  eq: '=',
  neq: '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
};

type WhereClause = { sql: string; params: SQLiteValue[] };

/**
 * 将过滤值编码为可绑定到 SQL 的标量值；返回 NOT_ENCODABLE 表示该值
 * 无法安全编译进 SQL，调用方应整体回退 JS 路径。
 */
function encodeFilterValue(column: string, value: unknown): SQLiteValue | typeof NOT_ENCODABLE {
  if (value === null) return null;
  if (BOOLEAN_COLUMNS.has(column) && typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number') return value;
  return NOT_ENCODABLE;
}

function safeQuoteIdentifier(value: string): string | null {
  try {
    return quoteIdentifier(value);
  } catch {
    return null;
  }
}

// neq/lt/lte 在 JS 路径会匹配 NULL 行（valuesEqual/compareValues 的语义），
// 而 SQL 的 `!=`/`<`/`<=` 会排除 NULL 行；可空列直接回退 JS，保证语义零漂移。
function nullUnsafeForCompiledComparison(table: string, column: string, operator: string): boolean {
  if (operator !== 'neq' && operator !== 'lt' && operator !== 'lte') return false;
  return getNullableColumns(table).has(column);
}

function compileComparison(table: string, filter: Filter): WhereClause | null {
  const columns = getTableColumns(table);
  if (!(filter.column in columns)) return null;
  const column = safeQuoteIdentifier(filter.column);
  if (!column) return null;
  const operator = COMPARISON_SQL[filter.operator];
  if (!operator) return null;
  if (filter.value === null) return null;
  if (nullUnsafeForCompiledComparison(table, filter.column, filter.operator)) return null;
  const encoded = encodeFilterValue(filter.column, filter.value);
  if (encoded === NOT_ENCODABLE) return null;
  return { sql: `${column} ${operator} ?`, params: [encoded] };
}

function compileFilter(table: string, filter: Filter): WhereClause | null {
  const columns = getTableColumns(table);
  if (!(filter.column in columns)) return null;
  const column = safeQuoteIdentifier(filter.column);
  if (!column) return null;

  if (filter.operator === 'in') {
    const values = filter.value;
    if (!Array.isArray(values) || values.length === 0) return null;
    const params: SQLiteValue[] = [];
    for (const value of values) {
      if (value === null) return null; // SQL IN 不匹配 NULL，语义与 JS 不同
      const encoded = encodeFilterValue(filter.column, value);
      if (encoded === NOT_ENCODABLE) return null;
      params.push(encoded);
    }
    return { sql: `${column} IN (${params.map(() => '?').join(', ')})`, params };
  }

  if (filter.value === null) {
    if (filter.operator === 'eq') return { sql: `${column} IS NULL`, params: [] };
    if (filter.operator === 'neq') return { sql: `${column} IS NOT NULL`, params: [] };
    return null;
  }

  return compileComparison(table, filter);
}

function compileOrExpression(table: string, expression: string): WhereClause | null {
  const clauses: string[] = [];
  const params: SQLiteValue[] = [];
  for (const term of splitOrExpression(expression)) {
    if (term.startsWith('and(') && term.endsWith(')')) {
      const inner: string[] = [];
      for (const condition of splitOrExpression(term.slice(4, -1))) {
        const filter = parseComparison(condition);
        if (!filter) return null;
        const compiled = compileComparison(table, filter);
        if (!compiled) return null;
        inner.push(compiled.sql);
        params.push(...compiled.params);
      }
      if (inner.length === 0) return null;
      clauses.push(`(${inner.join(' AND ')})`);
      continue;
    }
    const filter = parseComparison(term);
    if (!filter) return null;
    const compiled = compileComparison(table, filter);
    if (!compiled) return null;
    clauses.push(compiled.sql);
    params.push(...compiled.params);
  }
  if (clauses.length === 0) return null;
  return { sql: `(${clauses.join(' OR ')})`, params };
}

/**
 * 把 WHERE 过滤编译为参数化 SQL；任一条件不可编译则返回 null（全有或全无），
 * 调用方回退到原有的 JS 过滤路径。
 */
function buildWhereClause(table: string, filters: Filter[], orExpression: string | null): WhereClause | null {
  const clauses: string[] = [];
  const params: SQLiteValue[] = [];
  for (const filter of filters) {
    const compiled = compileFilter(table, filter);
    if (!compiled) return null;
    clauses.push(compiled.sql);
    params.push(...compiled.params);
  }
  if (orExpression) {
    const compiled = compileOrExpression(table, orExpression);
    if (!compiled) return null;
    clauses.push(compiled.sql);
    params.push(...compiled.params);
  }
  if (clauses.length === 0) return null; // 无过滤条件时保持原有全表路径
  return { sql: clauses.map((clause) => `(${clause})`).join(' AND '), params };
}

function localError(error: unknown): LocalError {
  return { message: error instanceof Error ? error.message : String(error) };
}

let database: DatabaseSync | null = null;
let databasePath: string | null = null;

export function getLocalDatabase(): DatabaseSync {
  const configuredPath = process.env.SQLITE_PATH?.trim();
  const targetPath = configuredPath
    ? resolve(configuredPath)
    : resolve(process.cwd(), 'data', 'ai-study.sqlite');
  if (database && databasePath === targetPath) return database;
  if (database) database.close();
  mkdirSync(dirname(targetPath), { recursive: true });
  database = new DatabaseSync(targetPath);
  database.exec(SQLITE_SCHEMA);
  databasePath = targetPath;
  return database;
}

export function getLocalDatabasePath(): string {
  const configuredPath = process.env.SQLITE_PATH?.trim();
  return configuredPath ? resolve(configuredPath) : resolve(process.cwd(), 'data', 'ai-study.sqlite');
}

function rawRows(table: string): SqlRow[] {
  assertTable(table);
  return getLocalDatabase()
    .prepare(`SELECT * FROM ${quoteIdentifier(table)}`)
    .all() as SqlRow[];
}

function relatedRows(parentTable: string, parent: SqlRow, relation: string): SqlRow[] {
  const db = getLocalDatabase();
  if (relation === 'questions' && 'question_id' in parent) {
    return db
      .prepare('SELECT * FROM "questions" WHERE id = ?')
      .all(encodeValue('question_id', parent.question_id)) as SqlRow[];
  }
  if (relation === 'question_analysis' && parentTable === 'questions') {
    return db
      .prepare('SELECT * FROM "question_analysis" WHERE question_id = ? ORDER BY created_at DESC')
      .all(encodeValue('id', parent.id)) as SqlRow[];
  }
  if (relation === 'practice_records' && parentTable === 'wrong_questions') {
    return db
      .prepare(
        'SELECT * FROM "practice_records" WHERE question_id = ? AND user_id = ? ORDER BY created_at DESC',
      )
      .all(encodeValue('question_id', parent.question_id), encodeValue('user_id', parent.user_id)) as SqlRow[];
  }
  if (relation === 'questions' && parentTable === 'practice_records') {
    return db
      .prepare('SELECT * FROM "questions" WHERE id = ?')
      .all(encodeValue('question_id', parent.question_id)) as SqlRow[];
  }
  return [];
}

function projectRow(table: string, row: SqlRow, nodes: SelectNode[]): SqlRow {
  const decoded = decodeRow(row);
  if (nodes.some((node) => node.field === '*')) return decoded;
  const result: SqlRow = {};
  for (const node of nodes) {
    if (!node.children) {
      result[node.field] = decodeValue(node.field, row[node.field]);
      continue;
    }
    const children = relatedRows(table, row, node.field);
    const projected = children.map((child) => projectRow(node.field, child, node.children!));
    // Foreign-key relations are represented as a single object by Supabase;
    // one-to-many relations remain arrays. Consumers already accept both.
    result[node.field] = node.field === 'questions' ? projected[0] ?? null : projected;
  }
  return result;
}

function insertRow(table: string, input: SqlRow): SqlRow {
  assertTable(table);
  const payload: SqlRow = { ...input };
  if ('id' in getTableColumns(table) && payload.id == null) payload.id = randomUUID();
  if ('created_at' in getTableColumns(table) && payload.created_at == null) payload.created_at = nowIso();
  if ('updated_at' in getTableColumns(table) && payload.updated_at == null) payload.updated_at = nowIso();

  const columns = Object.keys(payload).filter((column) => payload[column] !== undefined);
  if (columns.length === 0) throw new Error(`Cannot insert an empty row into ${table}`);
  const values = columns.map((column) => encodeValue(column, payload[column]));
  const placeholders = columns.map(() => '?').join(', ');
  getLocalDatabase()
    .prepare(
      `INSERT INTO ${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(', ')}) VALUES (${placeholders})`,
    )
    .run(...values);

  const primaryColumn = primaryKeyColumn(table);
  const inserted = getLocalDatabase()
    .prepare(`SELECT * FROM ${quoteIdentifier(table)} WHERE ${quoteIdentifier(primaryColumn)} = ?`)
    .get(encodeValue(primaryColumn, payload[primaryColumn])) as SqlRow | undefined;
  return inserted ?? payload;
}

function primaryKeyColumn(table: string): string {
  return table === 'standard_exams' ? 'exam_id' : 'id';
}

function defaultConflictColumns(table: string): string[] {
  switch (table) {
    case 'profiles':
    case 'user_profiles':
    case 'beijing_education_states':
      return ['user_id'];
    case 'knowledge_mastery':
      return ['user_id', 'phase', 'knowledge_point'];
    case 'user_memory_facts':
      return ['user_id', 'key'];
    case 'conversation_summaries':
      return ['conversation_id'];
    case 'standard_exams':
      return ['exam_id'];
    case 'standard_exam_records':
      return ['exam_id', 'record_key'];
    case 'app_content':
      return ['phase', 'subject', 'content_type'];
    default:
      return ['id'];
  }
}

const tableColumnsCache = new Map<string, Record<string, true>>();
const tableNullableColumnsCache = new Map<string, Set<string>>();

function getTableColumns(table: string): Record<string, true> {
  const cached = tableColumnsCache.get(table);
  if (cached) return cached;
  const rows = getLocalDatabase().prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all() as Array<{
    name: string;
    notnull: number;
  }>;
  const columns = Object.fromEntries(rows.map((row): [string, true] => [row.name, true]));
  const nullable = new Set(rows.filter((row) => !row.notnull).map((row) => row.name));
  tableColumnsCache.set(table, columns);
  tableNullableColumnsCache.set(table, nullable);
  return columns;
}

function getNullableColumns(table: string): Set<string> {
  getTableColumns(table); // 顺带填充可空列缓存
  return tableNullableColumnsCache.get(table) ?? new Set();
}

export class LocalQuery implements PromiseLike<LocalResult> {
  private readonly table: string;
  private selection = '*';
  private selectOptions: { count?: 'exact'; head?: boolean } = {};
  private filters: Filter[] = [];
  private orExpression: string | null = null;
  private orderings: Array<{ column: string; ascending: boolean; nullsFirst?: boolean }> = [];
  private offset = 0;
  private limitValue: number | null = null;
  private operation: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private mutationValues: SqlRow | SqlRow[] | null = null;
  private conflictColumns: string[] = [];
  private singleMode: 'single' | 'maybeSingle' | null = null;

  constructor(table: string) {
    this.table = table;
    assertTable(table);
  }

  select(columns = '*', options?: { count?: 'exact'; head?: boolean }): this {
    this.selection = typeof columns === 'string' ? columns : '*';
    this.selectOptions = options ?? {};
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, operator: 'eq', value });
    return this;
  }

  neq(column: string, value: unknown): this {
    this.filters.push({ column, operator: 'neq', value });
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.filters.push({ column, operator: 'in', value: values });
    return this;
  }

  not(column: string, operator: string, value: unknown): this {
    this.filters.push({ column, operator: operator === 'is' ? 'neq' : `not_${operator}`, value });
    return this;
  }

  gt(column: string, value: unknown): this {
    this.filters.push({ column, operator: 'gt', value });
    return this;
  }

  gte(column: string, value: unknown): this {
    this.filters.push({ column, operator: 'gte', value });
    return this;
  }

  lt(column: string, value: unknown): this {
    this.filters.push({ column, operator: 'lt', value });
    return this;
  }

  lte(column: string, value: unknown): this {
    this.filters.push({ column, operator: 'lte', value });
    return this;
  }

  or(expression: string): this {
    this.orExpression = expression;
    return this;
  }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): this {
    this.orderings.push({
      column,
      ascending: options?.ascending ?? true,
      nullsFirst: options?.nullsFirst,
    });
    return this;
  }

  limit(value: number): this {
    this.limitValue = Math.max(0, value);
    return this;
  }

  range(from: number, to: number): this {
    this.offset = Math.max(0, from);
    this.limitValue = Math.max(0, to - from + 1);
    return this;
  }

  insert(values: SqlRow | SqlRow[]): this {
    this.operation = 'insert';
    this.mutationValues = values;
    return this;
  }

  update(values: SqlRow): this {
    this.operation = 'update';
    this.mutationValues = values;
    return this;
  }

  upsert(values: SqlRow | SqlRow[], options?: { onConflict?: string }): this {
    this.operation = 'upsert';
    this.mutationValues = values;
    this.conflictColumns = (options?.onConflict ?? '').split(',').map((item) => item.trim()).filter(Boolean);
    return this;
  }

  delete(options?: { count?: 'exact' }): this {
    this.operation = 'delete';
    this.selectOptions = options ?? {};
    return this;
  }

  single(): this {
    this.singleMode = 'single';
    return this;
  }

  maybeSingle(): this {
    this.singleMode = 'maybeSingle';
    return this;
  }

  private matchRows(rows: SqlRow[]): SqlRow[] {
    return rows.filter((row) => {
      const filtersMatch = this.filters.every((filter) => {
        if (filter.operator === 'in') {
          return (filter.value as unknown[]).some((value) =>
            valuesEqual(
              row[filter.column],
              BOOLEAN_COLUMNS.has(filter.column) && typeof value === 'boolean' ? (value ? 1 : 0) : value,
            ),
          );
        }
        if (filter.operator === 'neq' && filter.value === null) return row[filter.column] != null;
        if (filter.operator === 'not_is') return !matchesFilter(row, { ...filter, operator: 'is' });
        if (filter.operator.startsWith('not_')) return !matchesFilter(row, { ...filter, operator: filter.operator.slice(4) });
        return matchesFilter(row, filter);
      });
      return filtersMatch && (!this.orExpression || matchesOr(row, this.orExpression));
    });
  }

  /**
   * 过滤后的原始行：WHERE 可编译时直接走参数化 SQL，
   * 不可编译（或 SQL 执行异常）时回退原有的 JS 全表过滤路径。
   */
  private selectRows(): SqlRow[] {
    const where = buildWhereClause(this.table, this.filters, this.orExpression);
    if (where) {
      try {
        return getLocalDatabase()
          .prepare(`SELECT * FROM ${quoteIdentifier(this.table)} WHERE ${where.sql}`)
          .all(...where.params) as SqlRow[];
      } catch {
        // 列名已预先校验，正常不会进入这里；兜底回退保持语义
      }
    }
    return this.matchRows(rawRows(this.table));
  }

  private sortRows(rows: SqlRow[]): SqlRow[] {
    if (this.orderings.length === 0) return rows;
    return [...rows].sort((left, right) => {
      for (const ordering of this.orderings) {
        const a = left[ordering.column];
        const b = right[ordering.column];
        if (a == null || b == null) {
          if (a == null && b == null) continue;
          const nullFirst = ordering.nullsFirst ?? false;
          return a == null === nullFirst ? -1 : 1;
        }
        const compared = compareValues(a, b);
        if (compared !== 0) return ordering.ascending ? compared : -compared;
      }
      return 0;
    });
  }

  private applyProjection(rows: SqlRow[]): any[] {
    const nodes = parseSelect(this.selection);
    return rows.map((row) => projectRow(this.table, row, nodes));
  }

  private runMutation(): SqlRow[] {
    const db = getLocalDatabase();
    if (this.operation === 'insert') {
      return (Array.isArray(this.mutationValues) ? this.mutationValues : [this.mutationValues!]).map((row) =>
        insertRow(this.table, row),
      );
    }

    if (this.operation === 'upsert') {
      const inputs = Array.isArray(this.mutationValues) ? this.mutationValues : [this.mutationValues!];
      return inputs.map((input) => {
        const conflict = this.conflictColumns.length > 0 ? this.conflictColumns : defaultConflictColumns(this.table);
        const existing = this.findExistingByConflict(conflict, input);
        if (!existing) return insertRow(this.table, input);
        const updates = Object.fromEntries(
          Object.entries(input).filter(([column, value]) => column !== 'id' && value !== undefined),
        );
        if (Object.keys(updates).length > 0) {
          const assignments = Object.keys(updates).map((column) => `${quoteIdentifier(column)} = ?`).join(', ');
          const primaryColumn = primaryKeyColumn(this.table);
          db.prepare(`UPDATE ${quoteIdentifier(this.table)} SET ${assignments} WHERE ${quoteIdentifier(primaryColumn)} = ?`).run(
            ...Object.keys(updates).map((column) => encodeValue(column, updates[column])),
            encodeValue(primaryColumn, existing[primaryColumn]),
          );
        }
        const primaryColumn = primaryKeyColumn(this.table);
        return db
          .prepare(`SELECT * FROM ${quoteIdentifier(this.table)} WHERE ${quoteIdentifier(primaryColumn)} = ?`)
          .get(encodeValue(primaryColumn, existing[primaryColumn])) as SqlRow;
      });
    }

    const targets = this.selectRows();
    if (this.operation === 'update') {
      const updates = this.mutationValues as SqlRow;
      const columns = Object.keys(updates).filter((column) => updates[column] !== undefined);
      if (columns.length > 0) {
        const assignments = columns.map((column) => `${quoteIdentifier(column)} = ?`).join(', ');
        for (const target of targets) {
          db.prepare(
            `UPDATE ${quoteIdentifier(this.table)} SET ${assignments} WHERE ${quoteIdentifier(primaryKeyColumn(this.table))} = ?`,
          ).run(
            ...columns.map((column) => encodeValue(column, updates[column])),
            encodeValue(primaryKeyColumn(this.table), target[primaryKeyColumn(this.table)]),
          );
        }
      }
      const primaryColumn = primaryKeyColumn(this.table);
      return targets.map(
        (target) =>
          db
            .prepare(`SELECT * FROM ${quoteIdentifier(this.table)} WHERE ${quoteIdentifier(primaryColumn)} = ?`)
            .get(encodeValue(primaryColumn, target[primaryColumn])) as SqlRow,
      );
    }
    if (this.operation === 'delete') {
      const primaryColumn = primaryKeyColumn(this.table);
      for (const target of targets) {
        db
          .prepare(`DELETE FROM ${quoteIdentifier(this.table)} WHERE ${quoteIdentifier(primaryColumn)} = ?`)
          .run(encodeValue(primaryColumn, target[primaryColumn]));
      }
      return targets;
    }
    return [];
  }

  /** 按冲突列定位已有行：等值参数化 SELECT；列缺失/值为空等边角回退旧的全表查找。 */
  private findExistingByConflict(conflict: string[], input: SqlRow): SqlRow | undefined {
    const columns = getTableColumns(this.table);
    const compilable =
      conflict.length > 0 &&
      conflict.every((column) => column in columns) &&
      conflict.every((column) => input[column] != null);
    if (compilable) {
      const conditions = conflict.map((column) => `${quoteIdentifier(column)} = ?`).join(' AND ');
      const params = conflict.map((column) => encodeValue(column, input[column]));
      return getLocalDatabase()
        .prepare(`SELECT * FROM ${quoteIdentifier(this.table)} WHERE ${conditions}`)
        .get(...params) as SqlRow | undefined;
    }
    return rawRows(this.table).find((row) => conflict.every((column) => valuesEqual(row[column], input[column])));
  }

  private async execute(): Promise<LocalResult> {
    try {
      let rows: SqlRow[];
      if (this.operation === 'select') {
        rows = this.selectRows();
      } else {
        rows = this.runMutation();
      }
      const total = rows.length;
      const sorted = this.sortRows(rows);
      const paged = this.limitValue == null ? sorted.slice(this.offset) : sorted.slice(this.offset, this.offset + this.limitValue);
      let data: any = this.applyProjection(paged);

      if (this.singleMode === 'single') {
        if (data.length !== 1) {
          return { data: null, count: this.selectOptions.count === 'exact' ? total : null, error: { message: data.length === 0 ? 'JSON object requested, no rows returned' : 'JSON object requested, multiple rows returned' } };
        }
        data = data[0];
      } else if (this.singleMode === 'maybeSingle') {
        if (data.length > 1) {
          return { data: null, count: this.selectOptions.count === 'exact' ? total : null, error: { message: 'JSON object requested, multiple rows returned' } };
        }
        data = data[0] ?? null;
      }

      if (this.selectOptions.head) data = null;
      return {
        data,
        count: this.selectOptions.count === 'exact' ? total : null,
        error: null,
      };
    } catch (error) {
      return { data: null, count: null, error: localError(error) };
    }
  }

  then<TResult1 = LocalResult, TResult2 = never>(
    onfulfilled?: ((value: LocalResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export type LocalDatabaseClient = {
  from(table: string): LocalQuery;
  rpc(name: string, args: Record<string, unknown>): Promise<LocalResult>;
};

function createLocalDatabaseClient(): LocalDatabaseClient {
  return {
    from(table: string): LocalQuery {
      return new LocalQuery(table);
    },
    async rpc(name: string, args: Record<string, unknown>): Promise<LocalResult> {
      try {
        const db = getLocalDatabase();
        if (name === 'match_questions') {
          const queryVector = vectorFromValue(args.query_embedding);
          const rows = rawRows('question_bank')
            .filter((row) => row.subject === args.match_subject && row.phase === args.match_phase)
            .map((row) => ({ row, vector: vectorFromValue(row.embedding) }))
            .filter((item): item is { row: SqlRow; vector: number[] } => Boolean(queryVector && item.vector));
          const minScore = Number(args.min_score ?? 0.78);
          const data = rows
            .map(({ row, vector }) => ({
              id: row.id,
              content: row.content,
              answer: row.answer,
              analysis: row.analysis,
              exam_point: row.exam_point,
              source: row.source,
              question_type: row.question_type,
              similarity: cosineSimilarity(queryVector!, vector),
            }))
            .filter((row) => row.similarity >= minScore)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, Math.max(1, Number(args.match_limit ?? 5)));
          return { data, count: null, error: null };
        }
        if (name === 'match_user_memories') {
          const queryVector = vectorFromValue(args.query_embedding);
          const rows = rawRows('user_memories')
            .filter(
              (row) =>
                row.user_id === args.match_user_id &&
                row.phase === (args.match_phase ?? 'high') &&
                row.source !== 'fact',
            )
            .map((row) => ({ row, vector: vectorFromValue(row.embedding) }))
            .filter((item): item is { row: SqlRow; vector: number[] } => Boolean(queryVector && item.vector));
          const minScore = Number(args.min_score ?? 0.6);
          const data = rows
            .map(({ row, vector }) => ({
              id: row.id,
              source: row.source,
              subject: row.subject,
              content: row.content,
              metadata: parseJson(row.metadata),
              similarity: cosineSimilarity(queryVector!, vector),
            }))
            .filter((row) => row.similarity >= minScore)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, Math.max(1, Number(args.match_limit ?? 5)));
          return { data, count: null, error: null };
        }
        void db;
        throw new Error(`Unsupported local RPC: ${name}`);
      } catch (error) {
        return { data: null, count: null, error: localError(error) };
      }
    },
  };
}

let client: LocalDatabaseClient | null = null;

export function getLocalDatabaseClient(): LocalDatabaseClient {
  if (!client) client = createLocalDatabaseClient();
  return client;
}

export function resetLocalDatabaseForTests(): void {
  client = null;
  tableColumnsCache.clear();
  tableNullableColumnsCache.clear();
  if (database) {
    database.close();
    database = null;
    databasePath = null;
  }
}
