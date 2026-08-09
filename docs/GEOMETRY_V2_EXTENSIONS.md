# Geometry V2 扩展规划（eval 等价匹配 / 立体几何 / 圆锥曲线 / 化学分子结构）

> 状态：**Phase A（eval v2 相对几何匹配）实施中；Phase B/C 规划定稿待排期**
> 基线：2026-08-09 · M2 核心已交付（schema 严格化 + eval 8/8 + iOS 渲染 + analyze 生产链路端到端）
> 关联：[GEOMETRY_PROMPT_EVAL.md](./GEOMETRY_PROMPT_EVAL.md)、[RENDER_AST.md](./RENDER_AST.md) §3、[VISUAL_AST.md](./VISUAL_AST.md)

---

## 0. 目标与原则

v1 已交付：10 种几何元素、scene/coordinateSystem 双根、严格字段校验、geometry task eval 8/8（平均 0.96）、iOS `GeometryCanvasView`、analyze 生产链路（后置 attach）。

本规划解决三块扩展，遵循四条原则：

1. **协议向后兼容**：v1 元素与字段只增不改；已有 eval 样本分数不降。
2. **每阶段独立交付**：schema 单测 → eval 样本 → 真 key 回归 → iOS 渲染 → CI 全绿，缺一不合并。
3. **边界清晰**：立体几何/圆锥曲线进 Geometry AST；化学分子结构是图（原子+键），另立 block kind，不塞进 Geometry AST。
4. **可靠优先**：AI 输出可靠性先于覆盖度；每个新元素都配 few-shot 与负例。

---

## A. Eval v2：几何等价匹配（平移 / 旋转 / 缩放不变性）

### A.1 现状局限

`coordinateScore` 用绝对坐标 + 贪心最近邻：整体平移 3 个单位即被重罚（现有单测 `坐标偏移被惩罚` 正是断言这一点）。真实场景中，AI 输出同一图形常因原点选择 / 缩放 / 摆放不同而坐标不同，绝对坐标会误伤正确输出。

### A.2 目标

- 平移 / 旋转 / 缩放等价的图形输出 → 高分（≈1）；
- 真正不同的图形（形状错误、镜像、多余元素）→ 低分；
- 对**语义敏感**的差异保持严格：`vector` 的方向与模长、`angle` 的度数、`functionCurve` 的表达式，不做变换等价。

### A.3 对齐算法（2D 相似变换）

对每个待匹配元素点集：

1. **平移**：减去质心；
2. **缩放**：除以点集 RMS 距离（单位化）；
3. **旋转**：Kabsch 最小二乘 2D 旋转（`θ = atan2(Σ(xa·yb − ya·xb), Σ(xa·xb + ya·yb))`）；
4. **距离**：对齐后贪心最近邻平均距离（归一化单位），阈值 0.12 内记 1 分，之后线性衰减。

按元素类型的等价语义：

| 类型 | 平移 | 缩放 | 旋转 | 说明 |
|------|:--:|:--:|:--:|------|
| point / line / triangle / polygon / angle / arc | ✅ | ✅ | ✅ | 形状等价 |
| circle / arc（半径） | ✅ | 半径比例 | — | 半径单独按比例评 |
| vector | ✅ | ❌ | ❌ | 方向与模长是物理语义 |
| functionCurve | 采样 MAE（沿用 v1，共享 xRange） | | | 符号等价不纳入 v2 |
| label | 文本匹配（沿用 v1） | | | 位置不参与坐标评分 |

### A.4 打分结构决策

- **保留 9 维结构与权重**，升级 `coordinate` 维度实现（避免权重表与通过阈值重构）；
- `angle`（度数）与 `expression`（采样）维度不变；
- 新增单测覆盖：平移等价、旋转等价、缩放等价、镜像不等价、向量方向敏感。

### A.5 样本扩展（8 → 12）

| # | 类型 | 验证点 |
|---|------|--------|
| 09 | 三角形平移 | 平移后仍应高分 |
| 10 | 三角形旋转 | 旋转后仍应高分 |
| 11 | 圆缩放 | 半径不同仍应高分 |
| 12 | 三角形镜像 | 镜像**不等价**，应低分 |

### A.6 验收

- 原 8 例在 v2 匹配下分数不降（真跑 eval 通过率 ≥ 80%，平均分 ≥ 0.75）；
- 新增 4 例：等价例 ≥ 0.9，镜像例 < 0.5；
- core 单测全绿、tsc 通过。

---

## B. 节点类型扩展：立体几何 + 圆锥曲线

### B.1 立体几何（平面图内表达）

**决策**：不引入 3D 坐标系统；AI 直接输出**等距投影后的 2D 顶点**，渲染器按线框绘制。

新增元素：

- `box`：`{ type:"box", vertices:[[x,y]×8], faces:[[i,j,k,l]×6] }`（顶点 + 面索引，消除歧义）；
- `cylinder`：`{ type:"cylinder", base:[x,y], radius, height, direction:[dx,dy] }`（示意线框）；
- `cone`：`{ type:"cone", base:[x,y], radius, height, direction:[dx,dy] }`；
- `sphere`：复用 `circle` + 两条辅助弧（经线/纬线，`style:"dashed"`），不新增元素。

Prompt：元素定义 + 1 个长方体 few-shot；约束「隐藏线用 dashed」。

验收：3 个样本（长方体、圆柱、圆锥）eval ≥ 0.8；iOS 线框渲染预览；schema 单测。

### B.2 圆锥曲线

**决策**：新增 `conic` 元素（隐式/标准式），显式函数形式继续用 `functionCurve`。

```json
{ "type": "conic", "kind": "ellipse"|"parabola"|"hyperbola", "center": [x,y], "a": 5, "b": 3, "rotation": 0 }
```

渲染器按 kind + 参数方程采样（椭圆/双曲线 θ ∈ [0,2π]；抛物线 t 区间）。

验收：3 个样本（椭圆、双曲线、抛物线标准式）eval ≥ 0.8；iOS 预览。

---

## C. 化学分子结构 graph 布局（V2 末段）

**决策**：新增独立 block kind `molecular`，与 Geometry AST 分离：

```json
{ "type": "visual", "kind": "molecular", "molecule": {
  "atoms": [{ "id": "O1", "symbol": "O", "x": 0, "y": 0 }],
  "bonds": [{ "from": "O1", "to": "H1", "order": 1 }]
} }
```

- AI 输出原子坐标（小分子手写坐标可靠；大分子先不做）；
- iOS 新增 `MolecularView`（原子圆 + 键线/双键线）；
- 与 `kind:"geometry"` 并存互斥，校验与降级逻辑复用 `sanitizeBlocks`。

验收：5 个常见分子（H₂O / CO₂ / CH₄ / NH₃ / 苯环）AI 输出可渲染；iOS 预览。

---

## 实施顺序

| 阶段 | 内容 | 影响面 | 依赖 |
|------|------|--------|------|
| Phase A | eval v2 相对匹配（A.1–A.6） | core only | 无 |
| Phase B1 | 立体几何元素 + prompt + 样本 + iOS drawer | core + ApiContracts + CoreKit | Phase A |
| Phase B2 | conic 元素 + prompt + 样本 + iOS drawer | core + ApiContracts + CoreKit | Phase A |
| Phase C | molecular block + schema + iOS MolecularView + 样本 | core + ApiContracts + CoreKit | 独立 |

每阶段合并前：`tsc --noEmit`、core 全量单测、`eval:geometry` 真 key 回归、iOS CI 全绿。

---

## 风险

- **立体投影坐标不稳定**：用 `box` 顶点+面索引降低歧义；必要时引入「正面/背面」约定；
- **旋转等价误放水**：镜像不视为等价（无反射变换）；向量/角度/表达式保持严格；
- **conic.rotation 渲染复杂度**：先用无旋转样本，rotation 字段后补；
- **分子坐标可靠性**：先限小分子；坐标与键序由 schema 校验 + eval 兜底。

*文档版本：2026-08-09 · Phase A 实施中，Phase B/C 规划定稿*
