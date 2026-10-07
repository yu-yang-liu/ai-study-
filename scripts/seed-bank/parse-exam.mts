// Step 2: turn extracted exam text into structured bank entries via DeepSeek.
// Output: tmp/seed/parsed/{year}-{subject}.json (cache) + tmp/seed/entries.jsonl.
// Usage: node scripts/seed-bank/parse-exam.mts [--subject 数学] [--year 2025] [--force]
import { mkdirSync, readdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  TMP_SEED,
  SUBJECTS,
  subjectSlug,
  chatJson,
  readTextSmart,
  refToUuid,
  type Subject,
} from './lib.mts';

const args = process.argv.slice(2);
const force = args.includes('--force');
function argValue(flag: string): string | null {
  const i = args.indexOf(flag);
  return i >= 0 ? (args[i + 1] ?? null) : null;
}
const onlySubject = argValue('--subject') as Subject | null;
const onlyYear = argValue('--year');

const parsedDir = join(TMP_SEED, 'parsed');
const textDir = join(TMP_SEED, 'text');
mkdirSync(parsedDir, { recursive: true });

const QUESTION_TYPES = ['选择题', '填空题', '解答题', '简答题', '计算题', '证明题', '作文', '阅读理解', '完形填空', '语法填空'];

type RawQuestion = {
  no: number;
  questionType: string;
  content: string;
  options: string[] | null;
  answer: string | null;
  analysis: string | null;
  examPoint: string | null;
  topic: string | null;
  difficulty: number | null;
};

type BankEntry = {
  id: string;
  ref: string;
  subject: string;
  year: number;
  topic: string | null;
  examPoint: string | null;
  questionType: string | null;
  content: string;
  options: string[] | null;
  answer: string | null;
  analysis: string | null;
  difficulty: number | null;
  source: string;
};

/** Detect top-level question numbers: lines like "1." "12、" "3．" (not 4-digit years, not options, not decimals like "4.096"). */
function detectQuestionNumbers(text: string): number[] {
  const nums = new Set<number>();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(\d{1,2})\s*[.．、](?!\d)/);
    if (m) nums.add(Number(m[1]));
  }
  return [...nums].sort((a, b) => a - b);
}

function normalizeAnswer(q: RawQuestion): string | null {
  if (!q.answer) return null;
  const answer = String(q.answer).trim();
  if (q.questionType === '选择题') {
    const letters = answer.toUpperCase().replace(/[^A-Z]/g, '');
    return letters || answer;
  }
  return answer;
}

function validate(q: RawQuestion, range: [number, number]): string | null {
  if (!Number.isInteger(q.no)) return 'no 不是整数';
  if (q.no < range[0] || q.no > range[1]) return `no ${q.no} 超出区间`;
  if (!q.content || q.content.trim().length < 5) return 'content 过短';
  if (!QUESTION_TYPES.includes(q.questionType)) return `questionType 非法: ${q.questionType}`;
  if (q.difficulty !== null && (!Number.isInteger(q.difficulty) || q.difficulty < 1 || q.difficulty > 10)) {
    return `difficulty 非法: ${q.difficulty}`;
  }
  if (q.questionType === '选择题') {
    if (!Array.isArray(q.options) || q.options.length < 2) return '选择题缺少选项';
    if (!q.answer) return '选择题缺少答案';
    if (q.answer && !/^[A-Z]{1,4}$/.test(normalizeAnswer(q) ?? '')) return `选择题答案非法: ${q.answer}`;
  }
  return null;
}

const SYSTEM_PROMPT = [
  '你是资深高中试题编辑，负责把 PDF 提取的试卷文本整理成结构化题库。',
  '注意：源文本来自 PDF，数学公式/符号的二维布局被打散（如上下标错位、分数线断裂、制表符插入），你需要按上下文把公式重建为可读的线性写法（如 x²、x/2、√3、f\'(x)、a₁）。',
  '严格遵守：不要捏造题干中不存在的条件或数据；无法恢复的符号用最接近的合理写法，宁缺毋滥。',
  '始终输出 JSON 对象。',
].join('\n');

function buildUserPrompt(paper: string, answers: string, range: [number, number]): Array<{ role: string; content: string }> {
  const fields = [
    '- no: 题号（整数）',
    `- questionType: 只能取 ${QUESTION_TYPES.join('/')}`,
    '- content: 题目完整文本（含小问；重建公式为线性写法）',
    '- options: 选择题为 ["A. ...","B. ...","C. ...","D. ..."]，其他题型为 null。源文本选项为空时如实返回 null 并在 analysis 开头注明【原文选项缺失】',
    '- answer: 选择题为去空格大写字母（多选如 "AC"）；其他题型为参考答案文本（无答案则 null）',
    '- analysis: 解析文字，优先采用解析版内容，无则 null',
    '- examPoint: 核心考点（2-10 字，如 "复数运算""文言文实词""牛顿第二定律"）',
    '- topic: 知识板块（如 "集合""导数""阅读理解"）',
    '- difficulty: 1-10 整数（10 最难，按高考定位估）',
  ].join('\n');
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        `只抽取第 ${range[0]} 到第 ${range[1]} 题（若某题号在文本中不存在则跳过）。`,
        '输出格式：{"questions": [每题一个对象]}，字段：',
        fields,
        '',
        '===== 试卷文本 =====',
        paper,
        '',
        '===== 参考答案/解析文本 =====',
        answers || '（无）',
      ].join('\n'),
    },
  ];
}

async function parseRange(
  paper: string,
  answers: string,
  range: [number, number],
): Promise<RawQuestion[]> {
  const messages = buildUserPrompt(paper, answers, range);
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const out = await chatJson<{ questions: RawQuestion[] }>(messages);
      const questions = Array.isArray(out.questions) ? out.questions : [];
      const inRange = questions.filter((q) => q && q.no >= range[0] && q.no <= range[1]);
      const problems = inRange.map((q) => validate(q, range)).filter(Boolean);
      if (inRange.length === 0 || (problems.length > 0 && attempt === 1)) {
        throw new Error(problems.slice(0, 3).join('; ') || '空结果');
      }
      if (problems.length > 0) {
        // Second attempt still imperfect: keep valid entries, report the rest.
        console.warn(`  range ${range[0]}-${range[1]}: ${problems.length} 条未通过校验已丢弃: ${problems.slice(0, 2).join('; ')}`);
      }
      return inRange.filter((q) => validate(q, range) === null);
    } catch (err) {
      if (attempt === 2) throw err;
      console.warn(`  range ${range[0]}-${range[1]} attempt 1 failed, retrying: ${err instanceof Error ? err.message : err}`);
    }
  }
  return [];
}

function chunkRanges(nums: number[], size: number): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (let i = 0; i < nums.length; i += size) {
    const group = nums.slice(i, i + size);
    ranges.push([group[0]!, group[group.length - 1]!]);
  }
  return ranges;
}

interface SourceJob {
  year: number;
  subject: Subject;
  paper: string;
  answers: string;
}

function loadJobs(): SourceJob[] {
  const jobs: SourceJob[] = [];
  for (const year of [2025, 2026]) {
    if (onlyYear && onlyYear !== String(year)) continue;
    for (const subject of SUBJECTS) {
      if (onlySubject && onlySubject !== subject) continue;
      const paperPath = join(textDir, `${year}-${subject}-paper.txt`);
      if (!existsSync(paperPath)) continue;
      const paper = readTextSmart(paperPath);
      const answersPath = join(textDir, `${year}-${subject}-answers.txt`);
      const answers = existsSync(answersPath) ? readTextSmart(answersPath) : paper;
      jobs.push({ year, subject, paper, answers });
    }
  }
  return jobs;
}

async function main(): Promise<void> {
  const jobs = loadJobs();
  if (jobs.length === 0) {
    console.error('no source text found — run extract-pdf.mts first (or check --subject/--year)');
    process.exit(1);
  }

  for (const job of jobs) {
    const cachePath = join(parsedDir, `${job.year}-${job.subject}.json`);
    if (!force && existsSync(cachePath)) {
      console.log(`${job.year} ${job.subject}: cached, skip (--force to redo)`);
      continue;
    }

    const nums = detectQuestionNumbers(job.paper);
    if (nums.length === 0) {
      console.warn(`${job.year} ${job.subject}: 未检测到题号，跳过`);
      continue;
    }
    const ranges = chunkRanges(nums, 6);
    console.log(`${job.year} ${job.subject}: ${nums.length} 题, ${ranges.length} 次调用 (paper ${job.paper.length} chars, answers ${job.answers.length} chars)`);

    const all: RawQuestion[] = [];
    for (const range of ranges) {
      const expected = nums.filter((n) => n >= range[0] && n <= range[1]);
      const got = await parseRange(job.paper, job.answers, range);
      console.log(`  range ${range[0]}-${range[1]}: ${got.length}/${expected.length} 题`);
      all.push(...got);
    }

    const seen = new Set<number>();
    const entries: BankEntry[] = [];
    for (const q of all) {
      if (seen.has(q.no)) continue;
      seen.add(q.no);
      const ref = `bgk${job.year}-${subjectSlug(job.subject)}-${String(q.no).padStart(2, '0')}`;
      entries.push({
        id: refToUuid(ref),
        ref,
        subject: job.subject,
        year: job.year,
        topic: q.topic ?? null,
        examPoint: q.examPoint ?? null,
        questionType: q.questionType,
        content: q.content.trim(),
        options: q.questionType === '选择题' && Array.isArray(q.options) ? q.options.map((o) => o.trim()) : null,
        answer: normalizeAnswer(q),
        analysis: q.analysis?.trim() || null,
        difficulty: q.difficulty ?? null,
        source: `${job.year}年北京高考${job.subject}试卷（网络收集版）`,
      });
    }
    const missing = nums.filter((n) => !seen.has(n));
    if (missing.length > 0) console.warn(`  缺失题号: ${missing.join(',')}`);

    writeFileSync(cachePath, JSON.stringify(entries, null, 2), 'utf8');
    console.log(`  → ${cachePath} (${entries.length} 题)`);
  }

  // Rebuild entries.jsonl deterministically from all parsed caches.
  const lines: string[] = [];
  for (const file of readdirSync(parsedDir).sort()) {
    if (!file.endsWith('.json')) continue;
    for (const entry of JSON.parse(readFileSync(join(parsedDir, file), 'utf8')) as BankEntry[]) {
      lines.push(JSON.stringify(entry));
    }
  }
  writeFileSync(join(TMP_SEED, 'entries.jsonl'), lines.join('\n') + '\n', 'utf8');
  console.log(`entries.jsonl: ${lines.length} 条`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
