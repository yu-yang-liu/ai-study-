import { z } from 'zod';
import type { TaskName } from '../gateway/types';

export const knowledgePointSchema = z.string().min(1);
export const subjectSchema = z.enum([
  '语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理',
]);

/**
 * Phase 1 Science AST —— 统一内容块（判别联合，AI → AST → Renderer）。
 *
 * 四类子 AST 映射：
 * - Text AST       → text / formula / image / table
 * - Visual AST     → visual（Phase 1 为占位；Phase 2 由 Geometry AST 真实渲染）
 * - Solution AST   → steps（可展示的解题轨迹，含步骤对错/标签）
 * - Interaction AST→ steps.interaction（折叠/可选择等交互元数据；几何交互在 Phase 2 扩展）
 *
 * 校验策略：后端严格判别联合（非法结构直接拒绝并重试），
 * iOS 解码端保持容错（未知/缺失字段降级不崩），保证客户端解析稳定。
 */
export interface StepContent {
  /** 步骤标题，如「第一步：化简」。 */
  title?: string;
  /** 步骤内容块（可递归包含公式/表格等）。 */
  blocks: Block[];
  /** 该步骤对错（批改场景）。 */
  isCorrect?: boolean;
  /** 能力点 / 方法标签，如「配方法」。 */
  tag?: string;
}

export type Block =
  | { type: 'text'; content: string }
  | { type: 'formula'; latex: string }
  | { type: 'image'; url: string; alt?: string }
  | { type: 'table'; headers?: string[]; rows: string[][] }
  | {
      type: 'steps';
      title?: string;
      steps: StepContent[];
      interaction?: { collapsible?: boolean; selectable?: boolean };
    }
  | { type: 'visual'; kind: 'placeholder' | 'geometry'; geometry?: unknown }
  | ChartBlock
  | CircuitBlock;

const textBlockSchema = z.object({
  type: z.literal('text'),
  content: z.string(),
});

const formulaBlockSchema = z.object({
  type: z.literal('formula'),
  /** 纯 LaTeX 源串，无 `$` 定界符（设计文件：公式是 AST 节点，latex 是其字段）。 */
  latex: z.string(),
});

const imageBlockSchema = z.object({
  type: z.literal('image'),
  url: z.string(),
  alt: z.string().optional(),
});

const tableBlockSchema = z.object({
  type: z.literal('table'),
  headers: z.array(z.string()).optional(),
  rows: z.array(z.array(z.string())).min(1),
});

/** 解题步骤（Solution AST）。steps 内可递归包含 formula/table 等块。 */
export const stepContentSchema = z.object({
  title: z.string().optional(),
  blocks: z.array(z.lazy(() => blockSchema)),
  isCorrect: z.boolean().optional(),
  tag: z.string().optional(),
});

const stepsBlockSchema = z.object({
  type: z.literal('steps'),
  title: z.string().optional(),
  steps: z.array(stepContentSchema).min(1),
  /** Interaction AST（Phase 1 最小子集）：折叠 / 可选择。 */
  interaction: z
    .object({
      collapsible: z.boolean().optional(),
      selectable: z.boolean().optional(),
    })
    .optional(),
});

const visualBlockSchema = z.object({
  type: z.literal('visual'),
  /** Phase 1 只允许 placeholder；Phase 2 引入 geometry 后由 Swift Canvas/Shape 渲染。 */
  kind: z.enum(['placeholder', 'geometry']).default('placeholder'),
  /** Phase 2：Geometry AST（scene / coordinateSystem）。 */
  geometry: z.unknown().optional(),
});

// ── Chart block（P1-1 统计图表；Visual AST 扩展：数据驱动图元）──

const chartMetaFields = {
  title: z.string().max(100).optional(),
  xLabel: z.string().max(40).optional(),
  yLabel: z.string().max(40).optional(),
} as const;

const chartSeriesSchema = z.object({
  name: z.string().max(40).optional(),
  values: z.array(z.number()).min(1).max(100),
  color: z.string().optional(),
});

/** bar / line 共用结构：分类轴 + 1–4 组数值系列。 */
function barLineChartSchema(kind: 'bar' | 'line') {
  return z.object({
    type: z.literal('chart'),
    kind: z.literal(kind),
    categories: z.array(z.string().max(40)).min(1).max(50),
    series: z.array(chartSeriesSchema).min(1).max(4),
    ...chartMetaFields,
  });
}

const scatterChartSchema = z.object({
  type: z.literal('chart'),
  kind: z.literal('scatter'),
  points: z.array(z.tuple([z.number(), z.number()])).min(1).max(200),
  ...chartMetaFields,
});

const histogramChartSchema = z.object({
  type: z.literal('chart'),
  kind: z.literal('histogram'),
  bins: z
    .array(
      z.object({
        range: z.tuple([z.number(), z.number()]),
        count: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(50),
  ...chartMetaFields,
});

const pieChartSchema = z.object({
  type: z.literal('chart'),
  kind: z.literal('pie'),
  slices: z
    .array(
      z.object({
        label: z.string().max(40),
        value: z.number().min(0),
      }),
    )
    .min(1)
    .max(20),
  title: z.string().max(100).optional(),
});

export const chartBlockSchema = z.discriminatedUnion('kind', [
  barLineChartSchema('bar'),
  barLineChartSchema('line'),
  scatterChartSchema,
  histogramChartSchema,
  pieChartSchema,
]);
export type ChartBlock = z.infer<typeof chartBlockSchema>;

// ── Circuit block（P1-2 电路图；Visual AST 扩展：元件符号 + 拓扑）──

export const circuitNodeTypeSchema = z.enum([
  'battery', 'resistor', 'switch', 'bulb', 'ammeter', 'voltmeter',
  'rheostat', 'motor', 'capacitor', 'diode', 'wire', 'ground',
]);
export type CircuitNodeType = z.infer<typeof circuitNodeTypeSchema>;

export const circuitNodeSchema = z.object({
  id: z.string().min(1).max(30),
  type: circuitNodeTypeSchema,
  x: z.number().min(-100).max(100),
  y: z.number().min(-100).max(100),
  /** 元件朝向；缺省 horizontal。 */
  orientation: z.enum(['horizontal', 'vertical']).optional(),
  label: z.string().max(40).optional(),
  /** 元件参数，如 "6V"、"10Ω"。 */
  value: z.string().max(20).optional(),
  /** 开关是否断开；缺省闭合。 */
  open: z.boolean().optional(),
});

export const circuitWireSchema = z.object({
  from: z.string().min(1).max(30),
  to: z.string().min(1).max(30),
  style: z.enum(['solid', 'dashed']).optional(),
});

export const circuitBlockSchema = z
  .object({
    type: z.literal('circuit'),
    title: z.string().max(100).optional(),
    nodes: z.array(circuitNodeSchema).min(2).max(30),
    wires: z.array(circuitWireSchema).min(1).max(40),
  })
  .superRefine((value, ctx) => {
    const ids = new Set(value.nodes.map((node) => node.id));
    for (const wire of value.wires) {
      if (!ids.has(wire.from) || !ids.has(wire.to)) {
        ctx.addIssue({
          code: 'custom',
          message: `wire 引用了不存在的节点: ${wire.from}-${wire.to}`,
        });
      }
    }
  });
export type CircuitBlock = z.infer<typeof circuitBlockSchema>;

export const blockSchema: z.ZodType<Block> = z.discriminatedUnion('type', [
  textBlockSchema,
  formulaBlockSchema,
  imageBlockSchema,
  tableBlockSchema,
  stepsBlockSchema,
  visualBlockSchema,
  chartBlockSchema,
  circuitBlockSchema,
]);

// ── Geometry AST（Phase 2 · Visual AST；与 visual-ast v1 对齐）──

export const sceneBoundsSchema = z.object({
  xMin: z.number(),
  yMin: z.number(),
  xMax: z.number(),
  yMax: z.number(),
});

const vec2Schema = z.tuple([z.number(), z.number()]);

const baseElementFields = {
  label: z.string().max(200).optional(),
  color: z.string().optional(),
  visible: z.boolean().optional(),
} as const;

const pointElementSchema = z.object({
  type: z.literal('point'),
  x: z.number().min(-100).max(100),
  y: z.number().min(-100).max(100),
  ...baseElementFields,
});

const lineElementSchema = z.object({
  type: z.literal('line'),
  from: vec2Schema,
  to: vec2Schema,
  style: z.enum(['solid', 'dashed']).optional(),
  ...baseElementFields,
});

const vectorElementSchema = z.object({
  type: z.literal('vector'),
  from: vec2Schema,
  to: vec2Schema,
  ...baseElementFields,
});

const triangleElementSchema = z.object({
  type: z.literal('triangle'),
  vertices: z.array(vec2Schema).length(3),
  labels: z.array(z.string()).max(3).optional(),
  ...baseElementFields,
});

const polygonElementSchema = z.object({
  type: z.literal('polygon'),
  points: z.array(vec2Schema).min(3),
  labels: z.array(z.string()).optional(),
  ...baseElementFields,
});

const circleElementSchema = z.object({
  type: z.literal('circle'),
  center: vec2Schema,
  radius: z.number().gt(0).max(100),
  fill: z.enum(['none', 'light']).optional(),
  ...baseElementFields,
});

const arcElementSchema = z.object({
  type: z.literal('arc'),
  center: vec2Schema,
  radius: z.number().gt(0).max(100),
  startAngle: z.number(),
  endAngle: z.number(),
  ...baseElementFields,
});

const angleElementSchema = z.object({
  type: z.literal('angle'),
  vertex: vec2Schema,
  from: vec2Schema,
  to: vec2Schema,
  degrees: z.number().optional(),
  ...baseElementFields,
});

const functionCurveElementSchema = z.object({
  type: z.literal('functionCurve'),
  expr: z.string().min(1).max(80),
  xRange: vec2Schema.optional(),
  samples: z.number().int().min(2).max(1000).optional(),
  ...baseElementFields,
});

const labelElementSchema = z.object({
  type: z.literal('label'),
  x: z.number().min(-100).max(100),
  y: z.number().min(-100).max(100),
  text: z.string().min(1).max(200),
  anchor: z.enum(['start', 'middle', 'end']).optional(),
  ...baseElementFields,
});

/**
 * 场线（P1-3）：匀强场平行线带 / 点电荷放射线 / 等高线（后续）。
 * - from/to：场线方向与长度（从 from 指向 to）；
 * - width/density：平行线带宽度与条数；
 * - radial=true + center：从 center 向 from→to 角度区间辐射。
 */
const fieldElementSchema = z.object({
  type: z.literal('field'),
  kind: z.enum(['electric', 'magnetic', 'contour']),
  from: vec2Schema,
  to: vec2Schema,
  width: z.number().gt(0).max(100).optional(),
  density: z.number().int().min(1).max(12).optional(),
  style: z.enum(['solid', 'dashed']).optional(),
  radial: z.boolean().optional(),
  center: vec2Schema.optional(),
  ...baseElementFields,
});

/** 光路（P1-3）：折线 + 方向箭头（入射/反射/折射/透镜光线）。 */
const rayElementSchema = z.object({
  type: z.literal('ray'),
  points: z.array(vec2Schema).min(2).max(8),
  arrow: z.enum(['start', 'end', 'both', 'none']).optional(),
  style: z.enum(['solid', 'dashed']).optional(),
  ...baseElementFields,
});

/** 几何元素（10 种类型，按 type 判别、关键字段必填；渲染器按 type 分发）。 */
export const geometryElementSchema = z.discriminatedUnion('type', [
  pointElementSchema,
  lineElementSchema,
  vectorElementSchema,
  triangleElementSchema,
  polygonElementSchema,
  circleElementSchema,
  arcElementSchema,
  angleElementSchema,
  functionCurveElementSchema,
  labelElementSchema,
  fieldElementSchema,
  rayElementSchema,
]);
export type GeometryElement = z.infer<typeof geometryElementSchema>;

/** Geometry AST 根节点（scene / coordinateSystem）。 */
export const geometryAstSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('scene'),
    elements: z.array(geometryElementSchema).max(20),
    bounds: sceneBoundsSchema.optional(),
  }).superRefine((value, ctx) => {
    if (value.elements.some((element) => element.type === 'functionCurve')) {
      ctx.addIssue({
        code: 'custom',
        message: 'scene 不能包含 functionCurve，函数图像应使用 coordinateSystem 根节点',
      });
    }
  }),
  z.object({
    type: z.literal('coordinateSystem'),
    xRange: vec2Schema,
    yRange: vec2Schema,
    xStep: z.number().gt(0).optional(),
    yStep: z.number().gt(0).optional(),
    showGrid: z.boolean().optional(),
    children: z.array(geometryElementSchema).max(20),
  }),
]);
export type GeometryAST = z.infer<typeof geometryAstSchema>;

/** geometry task 输出：geometry 可为 null（不需要图形）。 */
export const geometryOutputSchema = z.object({
  geometry: geometryAstSchema.nullable(),
  reason: z.string().max(200).optional(),
});
export type GeometryOutput = z.infer<typeof geometryOutputSchema>;

/** chart task 输出：chart 可为 null（不需要图表）。 */
export const chartOutputSchema = z.object({
  chart: chartBlockSchema.nullable(),
  reason: z.string().max(200).optional(),
});
export type ChartOutput = z.infer<typeof chartOutputSchema>;

/** circuit task 输出：circuit 可为 null（不需要电路图）。 */
export const circuitOutputSchema = z.object({
  circuit: circuitBlockSchema.nullable(),
  reason: z.string().max(200).optional(),
});
export type CircuitOutput = z.infer<typeof circuitOutputSchema>;

export const ocrOutput = z.object({
  text: z.string(),
  blocks: z.array(z.object({
    type: z.enum(['text', 'formula', 'image']),
    content: z.string(),
    confidence: z.number().min(0).max(1).optional(),
  })).optional(),
});
export type OcrOutput = z.infer<typeof ocrOutput>;

export const analyzeOutput = z.object({
  subject: subjectSchema,
  questionType: z.enum(['选择题', '填空题', '简答题', '计算题', '证明题', '作文']),
  knowledgePoints: z.array(knowledgePointSchema),
  difficulty: z.number().int().min(1).max(10),
  /**
   * 字符串字段由后端从对应 `*Blocks` 派生（见 `blocksToPlainText`），模型无需直接输出。
   * 保留它们是为了零破坏：persist(TEXT 列)、Web chat/grade 页、RAG、chat 模板等字符串消费者继续可用。
   * 双字段过渡期：blocks 为源、string 为派生，二者一致。
   */
  answer: z.string().optional(),
  analysis: z.string().optional(),
  examPoints: z.string().optional(),
  answerBlocks: z.array(blockSchema).optional(),
  analysisBlocks: z.array(blockSchema).optional(),
  examPointsBlocks: z.array(blockSchema).optional(),
});
export type AnalyzeOutput = z.infer<typeof analyzeOutput>;

export const gradeMathOutput = z.object({
  score: z.number().min(0),
  maxScore: z.number().min(1).default(100),
    isCorrect: z.boolean(),
    steps: z.array(z.object({
      stepNumber: z.number().int(),
      isCorrect: z.boolean(),
      feedback: z.string().optional(),
      feedbackBlocks: z.array(blockSchema).optional(),
    })),
  summary: z.string().optional(),
  summaryBlocks: z.array(blockSchema).optional(),
});
export type GradeMathOutput = z.infer<typeof gradeMathOutput>;

export const gradeEssayOutput = z.object({
  score: z.number().min(0),
  maxScore: z.number().min(1).default(60),
  dimensions: z.record(z.string(), z.number().min(0)),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  summary: z.string(),
});
export type GradeEssayOutput = z.infer<typeof gradeEssayOutput>;

export const planOutput = z.object({
  title: z.string(),
  description: z.string(),
  tasks: z.array(z.object({
    title: z.string(),
    subject: subjectSchema,
    knowledgePoints: z.array(knowledgePointSchema),
    estimatedMinutes: z.number().int().min(1),
    priority: z.enum(['高', '中', '低']),
    reason: z.string(),
  })),
  createdAt: z.string().optional(),
});
export type PlanOutput = z.infer<typeof planOutput>;

export const chatOutput = z.object({
  reply: z.string(),
  /** Chat 内容也走 AST：回复含公式/表格/步骤时输出结构化块（双字段过渡）。 */
  replyBlocks: z.array(blockSchema).optional(),
});
export type ChatOutput = z.infer<typeof chatOutput>;

export const chatAgentToolName = z.enum([
  'generate_plan',
  'analyze_question',
  'grade_submission',
  'summarize_wrong_questions',
  'remember_fact',
  'forget_fact',
]);

export const chatAgentOutput = z.object({
  reply: z.string().optional(),
  replyBlocks: z.array(blockSchema).optional(),
  tool: z
    .object({
      name: chatAgentToolName,
      args: z.record(z.string(), z.unknown()).default({}),
    })
    .optional(),
});
export type ChatAgentOutput = z.infer<typeof chatAgentOutput>;

export type ChatActionType = 'plan' | 'analyze' | 'grade' | 'wrong_questions';

/**
 * ChatAction 判别联合（discriminated union）。
 * 以 `type` 为判别字段，`payload` 携带对应动作的结构化结果，
 * 类型收窄后可直接访问 payload 字段，无需 `as Record<string, unknown>` 再断言。
 *
 * payload 分别对应：
 * - plan        → PlanOutput（executePlan 返回）
 * - analyze     → AnalyzeOutput（executeAnalyze 返回）
 * - grade       → GradeResult（executeGrade 返回）
 * - wrong_questions → WrongQuestionSummary（fetchWrongQuestionSummary 返回）
 *
 * 注：前端 chat/page.tsx 仍用本地 `payload: Record<string, unknown>` 宽类型接收
 * （API 边界序列化后不做运行时校验），与本联合类型在结构上兼容。
 */
export type ChatAction =
  | { type: 'plan'; payload: PlanOutput }
  | { type: 'analyze'; payload: AnalyzeOutput }
  | { type: 'grade'; payload: import('../../learning/actions').GradeResult }
  | { type: 'wrong_questions'; payload: import('../../learning/actions').WrongQuestionSummary };

export interface ChatAgentResult {
  reply: string;
  /** 结构化回复块（双字段过渡：reply 恒有，replyBlocks 供 iOS 优先渲染）。 */
  replyBlocks?: Block[];
  action?: ChatAction;
}

export const TASK_SCHEMA: Record<TaskName, z.ZodType<unknown>> = {
  ocr: ocrOutput,
  analyze: analyzeOutput,
  analyzeImg: analyzeOutput,
  gradeMath: gradeMathOutput,
  gradeEssay: gradeEssayOutput,
  plan: planOutput,
  chat: chatOutput,
  chatAgent: chatAgentOutput,
  geometry: geometryOutputSchema,
  chart: chartOutputSchema,
  circuit: circuitOutputSchema,
};
