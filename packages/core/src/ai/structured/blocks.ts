import { geometryAstSchema, type Block } from './schemas';

/**
 * 将 `Block[]` 压平为纯文本，填回现有的 string 字段（持久化 TEXT 列 / chat 模板 / eval / Web）。
 *
 * 这是 B 策略的「派生」环节：模型只输出 `blocks`，后端用此函数派生 string，
 * 二者同在 API 响应中返回。string 字段不入库也不由模型输出，blocks 是单一事实源。
 *
 * - text    → content
 * - formula → latex（保留 LaTeX 源串；缺失时回退 content，兼容 ocr 旧格式）
 * - image   → alt（缺失回退 url，再缺失回退 `[图]`）
 * - table   → 表头 + 每行以 ` | ` 连接
 * - steps   → 每步「标题：内容」以 `；` 连接（Solution AST 的 plain-text 投影）
 * - visual  → `[示意图]`（Phase 1 占位）
 *
 * 块间以单空格连接，结果 trim。纯函数，可单测。
 */
export function blocksToPlainText(blocks?: Block[] | null): string {
  if (!blocks || blocks.length === 0) return '';
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'text':
          return b.content ?? '';
        case 'formula':
          // 兼容 ocr 旧格式：latex 落在 content 字段（严格 schema 下为历史数据）。
          return b.latex ?? (b as { content?: string }).content ?? '';
        case 'image':
          return b.alt ?? b.url ?? '[图]';
        case 'table': {
          const head = b.headers ? `${b.headers.join(' | ')}\n` : '';
          return `${head}${b.rows.map((r) => r.join(' | ')).join('\n')}`;
        }
        case 'steps':
          return b.steps
            .map((s) => {
              const title = s.title ? `${s.title}：` : '';
              const content = blocksToPlainText(s.blocks);
              const tag = s.tag ? `（${s.tag}）` : '';
              return `${title}${content}${tag}`;
            })
            .join('；');
        case 'visual':
          return '[示意图]';
        case 'chart':
          return `[图表] ${b.title ?? b.kind}`;
        case 'circuit':
          return `[电路图] ${b.title ?? '电路'}`;
        case 'pedigree':
          return `[遗传系谱图] ${b.title ?? '系谱图'}`;
        case 'graph':
          return `[关系图] ${b.title ?? '图'}`;
        default:
          return '';
      }
    })
    .join(' ')
    .trim();
}

/**
 * 校验并降级 blocks 中的几何数据（M-D：生产链路接入 visual block）。
 *
 * - `visual` 块 `kind == "geometry"` 且 `geometry` 非法时，降级为
 *   `{ type: "visual", kind: "placeholder" }`，保证 analyze/chat 整响应不崩；
 * - `steps` 块递归处理内部 blocks；
 * - 输入为空（null/undefined）时原样返回，避免把「缺省」变成「空数组」。
 */
export function sanitizeBlocks(blocks?: Block[] | null): Block[] | undefined {
  if (!blocks || blocks.length === 0) return blocks ?? undefined;
  return blocks.map((block) => {
    if (block.type === 'visual' && block.kind === 'geometry' && block.geometry !== undefined) {
      if (!geometryAstSchema.safeParse(block.geometry).success) {
        return { type: 'visual', kind: 'placeholder' };
      }
    }
    if (block.type === 'steps') {
      return {
        ...block,
        steps: block.steps.map((step) => ({ ...step, blocks: sanitizeBlocks(step.blocks) ?? [] })),
      };
    }
    return block;
  });
}
