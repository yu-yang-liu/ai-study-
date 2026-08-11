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
  | CircuitBlock
  | PedigreeBlock
  | GraphBlock
  | LabBlock
  | CellBlock
  | MolecularBlock;

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

// ── Pedigree block（P1-4 遗传系谱图；专用符号：世代行 + 婚姻/子女连线）──

export const pedigreeIndividualSchema = z.object({
  id: z.string().min(1).max(30),
  gender: z.enum(['male', 'female', 'unknown']).default('unknown'),
  affected: z.boolean().optional(),
  carrier: z.boolean().optional(),
  deceased: z.boolean().optional(),
  label: z.string().max(40).optional(),
  proband: z.boolean().optional(),
});

export const pedigreeMarriageSchema = z.object({
  spouses: z.array(z.string()).length(2),
  children: z.array(z.string()).max(12).optional(),
});

export const pedigreeBlockSchema = z
  .object({
    type: z.literal('pedigree'),
    title: z.string().max(100).optional(),
    generations: z
      .array(
        z.object({
          label: z.string().max(10).optional(),
          individuals: z.array(pedigreeIndividualSchema).min(1).max(20),
        }),
      )
      .min(1)
      .max(6),
    marriages: z.array(pedigreeMarriageSchema).max(20),
  })
  .superRefine((value, ctx) => {
    const ids = new Set(value.generations.flatMap((g) => g.individuals.map((i) => i.id)));
    for (const marriage of value.marriages) {
      for (const id of [...marriage.spouses, ...(marriage.children ?? [])]) {
        if (!ids.has(id)) {
          ctx.addIssue({ code: 'custom', message: `marriage 引用了不存在的个体: ${id}` });
        }
      }
    }
  });
export type PedigreeBlock = z.infer<typeof pedigreeBlockSchema>;

// ── Graph block（P1-4 食物链/网 + 通用有向图；节点 + 有向边）──

export const graphNodeSchema = z.object({
  id: z.string().min(1).max(30),
  label: z.string().min(1).max(40),
  kind: z.enum(['producer', 'consumer', 'decomposer', 'organism', 'default']).optional(),
  x: z.number().min(-100).max(100),
  y: z.number().min(-100).max(100),
});

export const graphEdgeSchema = z.object({
  from: z.string().min(1).max(30),
  to: z.string().min(1).max(30),
  label: z.string().max(40).optional(),
  style: z.enum(['solid', 'dashed']).optional(),
});

export const graphBlockSchema = z
  .object({
    type: z.literal('graph'),
    title: z.string().max(100).optional(),
    nodes: z.array(graphNodeSchema).min(2).max(30),
    edges: z.array(graphEdgeSchema).min(1).max(40),
  })
  .superRefine((value, ctx) => {
    const ids = new Set(value.nodes.map((node) => node.id));
    for (const edge of value.edges) {
      if (!ids.has(edge.from) || !ids.has(edge.to)) {
        ctx.addIssue({ code: 'custom', message: `edge 引用了不存在的节点: ${edge.from}-${edge.to}` });
      }
    }
  });
export type GraphBlock = z.infer<typeof graphBlockSchema>;

// ── Lab block（P2-1 化学实验装置图；专用器材图元库：制气/蒸馏/过滤/萃取分液）──

export const labApparatusTypeSchema = z.enum([
  'flask',             // 圆底烧瓶
  'erlenmeyerFlask',   // 锥形瓶
  'beaker',            // 烧杯
  'testTube',          // 试管
  'funnel',            // 普通漏斗（过滤）
  'separatoryFunnel',  // 分液漏斗（萃取分液）
  'droppingFunnel',    // 滴液漏斗（制气加液）
  'condenser',         // 冷凝管（蒸馏）
  'thermometer',       // 温度计（蒸馏）
  'alcoholLamp',       // 酒精灯（加热）
  'stand',             // 铁架台
  'clamp',             // 铁夹
  'gasBottle',         // 集气瓶
  'waterTrough',       // 水槽（排水集气）
  'glassRod',          // 玻璃棒
  'filterPaper',       // 滤纸
  'deliveryTube',      // 导管
  'evaporatingDish',   // 蒸发皿
  'crucible',          // 坩埚
  'spoon',             // 药匙/镊子
  'other',
]);
export type LabApparatusType = z.infer<typeof labApparatusTypeSchema>;

export const labApparatusSchema = z.object({
  id: z.string().min(1).max(30),
  type: labApparatusTypeSchema,
  x: z.number().min(-100).max(100),
  y: z.number().min(-100).max(100),
  /** 器材朝向；缺省 vertical（数学坐标 y 向上）。 */
  orientation: z.enum(['horizontal', 'vertical', 'left', 'right']).optional(),
  /** 器材尺寸倍数，缺省 1（0.6–2.5）。 */
  scale: z.number().min(0.6).max(2.5).optional(),
  label: z.string().max(40).optional(),
  /** 内容物/介质，如 "水"、"滤液"、"MnO2" 等。 */
  content: z.string().max(20).optional(),
});

export const labConnectionSchema = z.object({
  from: z.string().min(1).max(30),
  to: z.string().min(1).max(30),
  /** 连接/流向类型；缺省 tube（导管/管路）。 */
  kind: z.enum(['tube', 'gasFlow', 'liquidFlow', 'heat']).optional(),
  label: z.string().max(40).optional(),
});

export const labBlockSchema = z
  .object({
    type: z.literal('lab'),
    title: z.string().max(100).optional(),
    apparatus: z.array(labApparatusSchema).min(1).max(30),
    connections: z.array(labConnectionSchema).max(30),
  })
  .superRefine((value, ctx) => {
    const ids = new Set(value.apparatus.map((a) => a.id));
    for (const connection of value.connections) {
      if (!ids.has(connection.from) || !ids.has(connection.to)) {
        ctx.addIssue({
          code: 'custom',
          message: `connection 引用了不存在的器材: ${connection.from}-${connection.to}`,
        });
      }
    }
  });
export type LabBlock = z.infer<typeof labBlockSchema>;

// ── Cell block（P2-2 生物细胞模式图；细胞器图元库：动植物/原核细胞 + 跨膜运输）──

export const cellTypeSchema = z.enum(['plant', 'animal', 'prokaryotic', 'other']);
export type CellType = z.infer<typeof cellTypeSchema>;

export const organelleTypeSchema = z.enum([
  'cellWall',        // 细胞壁（植物）
  'cellMembrane',    // 细胞膜
  'cytoplasm',       // 细胞质
  'nucleus',         // 细胞核
  'nucleolus',       // 核仁
  'mitochondria',    // 线粒体
  'chloroplast',     // 叶绿体（植物）
  'ribosome',        // 核糖体
  'er',              // 内质网
  'golgi',           // 高尔基体
  'vacuole',         // 液泡
  'lysosome',        // 溶酶体（动物）
  'centrosome',      // 中心体（动物/低等植物）
  'flagellum',       // 鞭毛（细菌/精子）
  'capsule',         // 荚膜（原核）
  'nucleoid',        // 拟核（原核）
  'plasmid',         // 质粒（原核）
  'other',
]);
export type OrganelleType = z.infer<typeof organelleTypeSchema>;

export const cellOrganelleSchema = z.object({
  id: z.string().min(1).max(30),
  type: organelleTypeSchema,
  x: z.number().min(-100).max(100),
  y: z.number().min(-100).max(100),
  /** 细胞器尺寸倍数，缺省 1（0.6–2.5）。 */
  scale: z.number().min(0.6).max(2.5).optional(),
  label: z.string().max(40).optional(),
  /** 功能/物质说明，如「有氧呼吸主要场所」「DNA」。 */
  content: z.string().max(40).optional(),
});

export const cellConnectionSchema = z.object({
  from: z.string().min(1).max(30),
  to: z.string().min(1).max(30),
  /** 细胞器间协作/流向；缺省 flow（物质流向）。 */
  kind: z.enum(['flow', 'energy', 'synthesis', 'signal']).optional(),
  label: z.string().max(40).optional(),
});

export const cellTransportSchema = z.object({
  id: z.string().min(1).max(30),
  /** 跨膜物质名，如「水」「葡萄糖」「Na+」「O2」。 */
  substance: z.string().min(1).max(20),
  /** 运输方式：diffusion 自由扩散 / facilitated 协助扩散 / activeTransport 主动运输 / osmosis 渗透。 */
  kind: z.enum(['diffusion', 'facilitated', 'activeTransport', 'osmosis']),
  /** 方向：in 进入细胞 / out 排出细胞。 */
  direction: z.enum(['in', 'out']),
  label: z.string().max(40).optional(),
});

export const cellBlockSchema = z
  .object({
    type: z.literal('cell'),
    title: z.string().max(100).optional(),
    /** 细胞类型：plant 植物 / animal 动物 / prokaryotic 原核。 */
    cellType: cellTypeSchema,
    organelles: z.array(cellOrganelleSchema).min(1).max(20),
    /** 细胞器间协作/物质流向（可选）。 */
    connections: z.array(cellConnectionSchema).max(20).optional(),
    /** 跨膜运输（可选；表示物质进出细胞的箭头）。 */
    transport: z.array(cellTransportSchema).max(10).optional(),
  })
  .superRefine((value, ctx) => {
    const ids = new Set(value.organelles.map((o) => o.id));
    for (const connection of value.connections ?? []) {
      if (!ids.has(connection.from) || !ids.has(connection.to)) {
        ctx.addIssue({
          code: 'custom',
          message: `connection 引用了不存在的细胞器: ${connection.from}-${connection.to}`,
        });
      }
    }
  });
export type CellBlock = z.infer<typeof cellBlockSchema>;

const molecularAtomSchema = z.object({
  id: z.string().min(1).max(20),
  symbol: z.string().min(1).max(3),
  x: z.number().min(-100).max(100),
  y: z.number().min(-100).max(100),
  charge: z.number().int().min(-9).max(9).optional(),
  label: z.string().max(20).optional(),
});

const molecularBondSchema = z.object({
  from: z.string().min(1).max(20),
  to: z.string().min(1).max(20),
  order: z.number().int().min(1).max(3).default(1),
});

export const molecularBlockSchema = z
  .object({
    type: z.literal('molecular'),
    title: z.string().max(100).optional(),
    atoms: z.array(molecularAtomSchema).min(1).max(50),
    bonds: z.array(molecularBondSchema).max(80),
  })
  .superRefine((value, ctx) => {
    const ids = new Set(value.atoms.map((atom) => atom.id));
    for (const bond of value.bonds) {
      if (!ids.has(bond.from) || !ids.has(bond.to)) {
        ctx.addIssue({
          code: 'custom',
          message: `bond 引用了不存在的原子: ${bond.from}-${bond.to}`,
        });
      }
    }
  });
export type MolecularBlock = z.infer<typeof molecularBlockSchema>;

export const blockSchema: z.ZodType<Block> = z.discriminatedUnion('type', [
  textBlockSchema,
  formulaBlockSchema,
  imageBlockSchema,
  tableBlockSchema,
  stepsBlockSchema,
  visualBlockSchema,
  chartBlockSchema,
  circuitBlockSchema,
  pedigreeBlockSchema,
  graphBlockSchema,
  labBlockSchema,
  cellBlockSchema,
  molecularBlockSchema,
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

const conicElementSchema = z.object({
  type: z.literal('conic'),
  kind: z.enum(['ellipse', 'parabola', 'hyperbola']),
  center: vec2Schema,
  a: z.number().gt(0).max(100),
  b: z.number().gt(0).max(100).optional(),
  rotation: z.number().optional(),
  ...baseElementFields,
});

const boxElementSchema = z.object({
  type: z.literal('box'),
  vertices: z.array(vec2Schema).length(8),
  faces: z.array(z.array(z.number().int().min(0).max(7)).min(3).max(4)).min(1).max(6),
  ...baseElementFields,
});

const cylinderElementSchema = z.object({
  type: z.literal('cylinder'),
  base: vec2Schema,
  radius: z.number().gt(0).max(100),
  height: z.number().gt(0).max(100),
  direction: vec2Schema,
  ...baseElementFields,
});

const coneElementSchema = z.object({
  type: z.literal('cone'),
  base: vec2Schema,
  radius: z.number().gt(0).max(100),
  height: z.number().gt(0).max(100),
  direction: vec2Schema,
  ...baseElementFields,
});

const relationElementSchema = z.object({
  type: z.literal('relation'),
  from: vec2Schema,
  to: vec2Schema,
  relation: z.enum(['parallel', 'perpendicular', 'equal', 'similar', 'dependsOn', 'custom']).optional(),
  style: z.enum(['solid', 'dashed']).optional(),
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

/** 几何元素（含立体线框、圆锥曲线和关系节点扩展）。 */
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
  conicElementSchema,
  boxElementSchema,
  cylinderElementSchema,
  coneElementSchema,
  relationElementSchema,
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

/** pedigree task 输出：pedigree 可为 null（不需要系谱图）。 */
export const pedigreeOutputSchema = z.object({
  pedigree: pedigreeBlockSchema.nullable(),
  reason: z.string().max(200).optional(),
});
export type PedigreeOutput = z.infer<typeof pedigreeOutputSchema>;

/** graph task 输出：graph 可为 null（不需要图）。 */
export const graphOutputSchema = z.object({
  graph: graphBlockSchema.nullable(),
  reason: z.string().max(200).optional(),
});
export type GraphOutput = z.infer<typeof graphOutputSchema>;

const labOutputWrapperSchema = z.object({
  lab: labBlockSchema.nullable(),
  reason: z.string().max(200).optional(),
});
export type LabOutput = z.infer<typeof labOutputWrapperSchema>;
/** 模型原始输出：允许包装对象 / 裸 Lab AST / null（容错归一，见 normalizeLabOutput）。 */
export type LabOutputRaw = LabOutput | LabBlock | null;
export const labOutputSchema = z.union([labOutputWrapperSchema, labBlockSchema, z.null()]);

/** 把模型原始输出归一化为统一包装形态 `{ lab, reason }`。 */
export function normalizeLabOutput(output: LabOutputRaw): LabOutput {
  if (output === null) return { lab: null };
  if (typeof output === 'object' && 'lab' in output) {
    return { lab: output.lab, reason: output.reason };
  }
  return { lab: output as LabBlock };
}

const cellOutputWrapperSchema = z.object({
  cell: cellBlockSchema.nullable(),
  reason: z.string().max(200).optional(),
});
export type CellOutput = z.infer<typeof cellOutputWrapperSchema>;
/** 模型原始输出：允许包装对象 / 裸 Cell AST / null（容错归一，见 normalizeCellOutput）。 */
export type CellOutputRaw = CellOutput | CellBlock | null;
export const cellOutputSchema = z.union([cellOutputWrapperSchema, cellBlockSchema, z.null()]);

/** 把模型原始输出归一化为统一包装形态 `{ cell, reason }`。 */
export function normalizeCellOutput(output: CellOutputRaw): CellOutput {
  if (output === null) return { cell: null };
  if (typeof output === 'object' && 'cell' in output) {
    return { cell: output.cell, reason: output.reason };
  }
  return { cell: output as CellBlock };
}

const molecularOutputWrapperSchema = z.object({
  molecular: molecularBlockSchema.nullable(),
  reason: z.string().max(200).optional(),
});
export type MolecularOutput = z.infer<typeof molecularOutputWrapperSchema>;
export type MolecularOutputRaw = MolecularOutput | MolecularBlock | null;
export const molecularOutputSchema = z.union([
  molecularOutputWrapperSchema,
  molecularBlockSchema,
  z.null(),
]);

export function normalizeMolecularOutput(output: MolecularOutputRaw): MolecularOutput {
  if (output === null) return { molecular: null };
  if (typeof output === 'object' && 'molecular' in output) {
    return { molecular: output.molecular, reason: output.reason };
  }
  return { molecular: output as MolecularBlock };
}

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
  questionId: z.string().optional(),
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
    taskId: z.string().optional(),
    title: z.string(),
    subject: subjectSchema,
    knowledgePoints: z.array(knowledgePointSchema),
    estimatedMinutes: z.number().int().min(1),
    priority: z.enum(['高', '中', '低']),
    reason: z.string(),
    status: z.enum(['pending', 'completed', 'skipped']).optional(),
    completedAt: z.string().optional(),
    skippedAt: z.string().optional(),
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
  pedigree: pedigreeOutputSchema,
  graph: graphOutputSchema,
  lab: labOutputSchema,
  cell: cellOutputSchema,
  molecular: molecularOutputSchema,
};
