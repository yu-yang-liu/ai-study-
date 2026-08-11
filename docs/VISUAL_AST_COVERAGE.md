# Visual AST 高中学段覆盖总表（补建档）

> 状态：**补建档完成（2026-08-10）**——按新课标盘点高中各学科可视化内容，标注表达方式、状态与优先级；实施以本表为准
> 关联：[VISUAL_AST.md](./VISUAL_AST.md)（协议 v1）、[GEOMETRY_V2_EXTENSIONS.md](./GEOMETRY_V2_EXTENSIONS.md)（几何扩展详设）、[SCIENCE_AST_IOS_ROADMAP.md](./SCIENCE_AST_IOS_ROADMAP.md)（版本路线）

---

## 1. 表达方式（E 分类）

| 代号 | 表达方式 | 说明 | 示例 |
|------|----------|------|------|
| **G1** | Geometry AST 现有元素 | `scene`/`coordinateSystem` + point/line/vector/triangle/polygon/circle/arc/angle/functionCurve/label | 平面几何、函数图像、受力分析 |
| **G2** | Geometry AST 扩展元素 | 在 v1 协议上**只增不改**：`conic`（圆锥曲线）、`solid`（立体线框）、`ray`（光路）、`field`（场线/等高线） | 椭圆、长方体、折射光路、电场线 |
| **M** | 专用 block kind | 独立 schema + 独立渲染视图，与 geometry 并存 | `molecular`（分子/有机）、`circuit`（电路）、`chart`（统计图表）、`pedigree`（遗传系谱）等 |
| **T** | 现有 text/table block | 不需要专门视觉 | 定义、公式推导、Punnett 方格（表格） |
| **P** | 暂缓 | 依赖交互/动画/3D，排后 | 动态几何拖动、细胞分裂动画、3D 旋转 |

**原则**：能用 G1 表达的不新造；G2 只补几何语义缺口；图元类（电路符号、细胞器、实验器材）一律走 M 专用 block + 图元库，不塞进 Geometry AST。

---

## 2. 覆盖总表

### 2.1 数学

| 模块 | 可视化内容 | 表达 | 状态 | 优先级 |
|------|-----------|------|------|:--:|
| 集合与逻辑 | 韦恩图 | G1（circle + label 相交区域） | 可建 | P1 |
| 函数 | 基本初等函数图像 | G1（coordinateSystem + functionCurve） | ✅ 已建 | P0 |
| 三角函数 | 单位圆、三角曲线、相位变化 | G1（coordinateSystem + circle + vector + functionCurve） | 可建 | P1 |
| 平面向量 | 向量加减、数量积几何意义 | G1（vector 已建） | ✅ 已建 | P0 |
| 复数 | 复平面 | G1（coordinateSystem + point） | 可建 | P2 |
| 立体几何 | 直观图、三视图、截面、二面角 | G2（solid：box/cylinder/cone + 投影约定） | 规划（B1） | P1 |
| 解析几何 | 直线与圆 | G1（line/circle 已建） | ✅ 已建 | P0 |
| 圆锥曲线 | 椭圆/双曲线/抛物线 | G2（conic：center/a/b/rotation） | 规划（B2） | P1 |
| 数列 | 等差/等比点列图 | G1（coordinateSystem + point） | 可建 | P2 |
| 不等式 | 线性规划可行域 | G1（polygon + line + label） | 可建 | P2 |
| 统计 | 频率分布直方图、茎叶图、散点图、回归直线 | M（chart block：bar/line/scatter/histogram/pie） | 🆕 **P1-1 实施完成**（core task/eval + iOS 渲染，2026-08-10 待 CI） | P1 |
| 概率 | 正态分布曲线、几何概型区域、树状图 | G1（functionCurve/polygon）+ M（tree 简易） | 部分可建 | P2 |
| 导数 | 切线、单调区间、极值图像 | G1（coordinateSystem + line/point） | 可建 | P2 |
| 极坐标/参数方程 | 极坐标曲线、参数曲线 | G1/G2（functionCurve 参数化） | 可建 | P3 |

### 2.2 物理

| 模块 | 可视化内容 | 表达 | 状态 | 优先级 |
|------|-----------|------|------|:--:|
| 运动学 | x-t/v-t 图像、匀变速情境 | G1（coordinateSystem + functionCurve/line + vector） | ✅ 已建（函数图像） | P0 |
| 相互作用 | 受力分析、平行四边形合成 | G1（vector/angle/line 已建） | ✅ 已建 | P0 |
| 牛顿定律 | 滑块/传送带/连接体示意 | G1（polygon + vector + label） | 可建 | P1 |
| 曲线运动 | 平抛轨迹、圆周运动、向心示意 | G1（functionCurve + circle + vector） | 可建 | P1 |
| 万有引力 | 天体轨道示意 | G1/G2（circle + ellipse→conic） | 可建 | P2 |
| 机械能/动量 | 碰撞、能量转化示意 | G1 + M（简易 flow） | 可建 | P2 |
| 静电场 | 电场线、等势面、带电粒子轨迹 | G2（field 曲线族）+ G1 | **未建档 → 本次补** | P1 |
| 恒定电流 | 电路图（电源/电阻/开关/电表） | M（circuit block + 符号图元库） | **未建档 → 本次补** | P1 |
| 磁场 | 磁感线、安培力/洛伦兹力方向 | G2（field）+ G1（vector） | **未建档 → 本次补** | P1 |
| 电磁感应 | 磁通量变化、感应电流示意 | G2/G1 | 可建 | P2 |
| 交变电流 | 正弦波形、变压器示意 | G1（functionCurve）+ M（circuit 扩展） | 可建 | P2 |
| 振动与波 | 振动图像、波形图、横波/纵波 | G1（functionCurve + point 序列） | 可建 | P1 |
| 光学 | 反射/折射/全反射/透镜光路 | G2（ray + 界面/透镜图元） | **未建档 → 本次补** | P1 |
| 热学 | p-V/p-T 图、分子运动示意 | G1 + M | 可建 | P3 |
| 原子物理 | 能级图、核反应示意 | M（levelDiagram block） | **未建档 → 本次补** | P2 |

### 2.3 化学

| 模块 | 可视化内容 | 表达 | 状态 | 优先级 |
|------|-----------|------|------|:--:|
| 物质结构 | 原子结构示意、元素周期表 | G1（circle）+ M（periodicTable 或 table） | 可建 | P2 |
| 化学键/分子 | 结构式、球棍模型、有机键线式 | M（molecular block） | 规划（C） | P1 |
| 晶胞 | NaCl/金刚石等晶胞线框 | G2（solid box + point 原子） | 可建 | P2 |
| 反应速率/平衡 | 浓度-时间、速率-温度曲线 | G1（coordinateSystem + functionCurve） | 可建 | P1 |
| 水溶液离子平衡 | 滴定曲线、pH 变化 | G1（functionCurve） | 可建 | P2 |
| 电化学 | 原电池/电解池示意 | M（circuit 扩展：电极 + 离子迁移箭头） | **未建档 → 本次补** | P2 |
| 有机化学 | 同分异构/官能团结构 | M（molecular） | 规划（C） | P1 |
| 化学实验 | 制气/蒸馏/过滤/萃取装置图 | M（lab block + 器材图元库） | **未建档 → 本次补** | P2 |
| 工艺流程 | 流程图 | M（flow block） | **未建档 → 本次补** | P3 |

### 2.4 生物

| 模块 | 可视化内容 | 表达 | 状态 | 优先级 |
|------|-----------|------|------|:--:|
| 分子与细胞 | 细胞模式图（动植物）、细胞器 | M（biology block + 细胞器图元） | **未建档 → 本次补** | P2 |
| 物质运输 | 跨膜运输示意 | G1/M | 可建 | P3 |
| 代谢 | 光合/呼吸作用过程图 | M（flow/多帧） | **未建档 → 本次补** | P2 |
| 细胞增殖 | 有丝/减数分裂示意 | P（多帧/动画）或 M（sequence） | 暂缓 | P3 |
| 遗传 | 遗传系谱图、DNA 结构、中心法则 | M（pedigree block；DNA 示意；flow） | **未建档 → 本次补** | P1 |
| 变异/育种 | 育种流程 | M（flow） | 可建 | P3 |
| 进化 | 种群基因频率变化 | G1（functionCurve/bar） | 可建 | P3 |
| 稳态 | 血糖/体温调节回路 | M（graph/flow） | 可建 | P3 |
| 生态 | 种群增长曲线（J/S 型）、食物链/网、能量流动 | G1（functionCurve）+ M（graph 节点边 + flow） | **未建档 → 本次补** | P2 |
| 生物技术 | PCR/基因工程流程 | M（flow） | 可建 | P3 |

### 2.5 地理

| 模块 | 可视化内容 | 表达 | 状态 | 优先级 |
|------|-----------|------|------|:--:|
| 地球运动 | 昼夜交替、四季、五带、黄赤交角 | G1（circle + arc + label） | 可建 | P2 |
| 大气 | 气压带风带、热力环流 | M（field/arrow 场图） | **未建档 → 本次补** | P2 |
| 水循环/洋流 | 水循环示意图、洋流分布 | M（flow + field） | **未建档 → 本次补** | P2 |
| 地貌 | 等高线地形图、地形剖面 | G2（contour 曲线族）+ M（cross-section） | **未建档 → 本次补** | P3 |
| 地质构造 | 褶皱/断层剖面 | M（cross-section） | 可建 | P3 |
| 人口/城市/产业 | 统计图表、区位示意图 | M（chart 复用）+ G1 | 🆕 P1-1 可复用 | P2 |
| 区域发展 | 示意图 | M | 可建 | P3 |

### 2.6 通用/未来

| 内容 | 表达 | 状态 | 优先级 |
|------|------|------|:--:|
| 统计图表（柱状/折线/饼/直方图/散点） | M（chart block） | 🆕 **P1-1 实施完成**（`chart` task eval 8/8 + e2e 2/2 + iOS ChartCanvasView，2026-08-10） | P1 |
| 流程图/思维导图 | M（graph/flow） | 未建档 | P2 |
| 动态几何（拖动顶点、自动辅助线） | P（交互后置） | 设计文件「未来支持」 | P3 |
| 参数变化联动（滑块重绘） | P | 设计文件 Phase 2「参数变化」 | P3 |

---

## 3. 状态统计与下一步

### 3.1 现状

- ✅ 已建：平面几何、函数图像、受力分析/向量、运动图像（G1 直接覆盖）
- 📐 已规划（详设在手）：立体几何（B1）、圆锥曲线（B2）、分子结构（C）
- 🆕 本次补建档：**chart（统计图表，P1-1 已实施）**、circuit（电路）、field（场线/等高线）、ray（光路）、pedigree（遗传系谱）、graph/flow（图与流程）、lab（实验装置）、biology（细胞模式图）、levelDiagram（能级图），以及地理场图/剖面、生物曲线等 G1 可直建项（其余待排期）

### 3.2 推荐实施顺序（结合高考频次 × 渲染可行性 × AI 输出可靠性）

| 批次 | 内容 | 理由 |
|------|------|------|
| **P1-1** | 统计图表 chart block（直方图/散点/折线/柱状） | ✅ 已实施（2026-08-10）：`chart` task + 8 样本 eval + 后置 attach + iOS ChartCanvasView；待 CI 全绿后合并 |
| **P1-2** | 电路图 circuit block（符号图元库） | 高考物理高频；符号固定、AI 输出可靠（元件清单+连接关系） |
| **P1-3** | 场线 field（电场线/磁感线/等高线）+ 光路 ray | 物理高频；G2 扩展元素，几何语义清晰 |
| **P1-4** | 遗传系谱 pedigree + 食物链/网 graph | 生物高频；符号规范，图布局可模板化 |
| **P2** | 实验装置 lab、细胞模式图 biology、能级图 levelDiagram、流程图 flow | 覆盖面广但 AI 输出与渲染成本上升 |
| **P3** | 动态几何、动画、3D、参数联动 | 交互后置，等 G1/G2/M 稳定后再做 |

### 3.3 每批次交付门槛

1. schema（zod + Swift Codable）与单测；
2. AI 提示词 + eval 样本（真 key 通过率 ≥ 80%）；
3. iOS 渲染视图 + CI 全绿；
4. 生产链路接入（复用后置 attach 或 blocks 直出）。

---

*文档版本：2026-08-10 · 补建档完成；实施排期以本表 + GEOMETRY_V2_EXTENSIONS.md 为准*
