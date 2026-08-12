# 北京高中学习算法基线

> 版本：v1.0 · 2026-08-13
>
> 本文档描述北京高中学习系统的事实状态、标准卷校准、掌握度和数据边界。
> 它与 Science AST V3 的渲染/未来知识图谱计划独立；后续可以复用抽取结果，但不改变 V3 的职责。

## 1. 已确认的产品边界

- 当前只服务北京高中。
- 北京高中状态需要覆盖：年级、学习阶段、合格考状态、选科意向/确认状态和学科成绩证据。
- 做选科状态分析，但不主动提醒用户选科，也不做院校专业组匹配，避免系统替用户影响选择。
- 普通练习、错题和日常测试不产生正式赋分。
- 只有带有同场考试相对位置和赋分数据的标准卷，才写入真实赋分观测值。
- A/B/C 级标准卷数据均可进入系统，但必须保留来源等级、验证状态和置信度。
- 赋分由确定性校准算法计算；AI 可以分析选科历史和结构化成绩，但不能直接改写赋分观测值。
- 合格考只记录 `passed` / `failed` / `not_taken`，不进入等级赋分计算。

## 2. 数据分层

```text
普通练习 / 批改证据
        ↓
知识点掌握度 + 学科能力 + 不确定性
        ↓
标准卷原始分 / 百分位校准
        ↓
等级分区间与学习状态
```

三类数据不能混用：

| 数据 | 作用 | 是否有真实赋分 |
|---|---|---|
| 普通练习 | 更新掌握度、难度表现、错误类型 | 否 |
| 合格考 | 更新科目合格状态 | 否 |
| 标准卷 | 校准原始分、百分位和赋分 | 是，只有来源中存在可核验赋分时 |

## 3. 标准卷数据协议

实现位置：`packages/core/src/beijing/`。

顶层版本：`beijing-standard-exam.v1`。

标准卷元数据至少包含：

- `examId`
- `examType`
- `examStage`
- `subject`
- `grade`
- `region`
- `examDate`
- `maxRawScore`
- `candidateCount`
- `sourceLevel`
- `sourceName`
- `verificationStatus`

分数记录包含：

- `rawScore` 或 `rawScoreMin/rawScoreMax`
- `rank` 或 `percentile`
- `percentileDefinition`
- `convertedScore`
- `gradeBand`
- `recordType`

`percentile` 必须明确口径。算法内部统一使用“越高越好”的 standing percentile；如果来源是“低于该分数的比例”，导入时转换为统一口径。

### 来源等级

| 等级 | 定义 | 初始系统权重 |
|---|---|---:|
| A | 北京正式考试或可核验官方数据 | 1.00 |
| B | 市级、区级或大型联考，分布和赋分较完整 | 0.75 |
| C | 机构整理、公开样本或估算数据 | 0.40 |

上述权重是系统的初始置信度策略，不是北京官方赋分规则，后续应使用真实回测校准。

## 4. 赋分校准边界

实现位置：`packages/core/src/beijing/calibration.ts`。

当前算法遵循以下规则：

1. 只使用 `recordType = observed` 的真实观测记录作为校准锚点。
2. 原始分精确命中锚点时，返回 `exact_observed`。
3. 位于两个观测锚点之间时，使用单调分段插值，返回预测值、区间和置信度。
4. 低于或高于观测范围时不外推，返回 `unavailable`。
5. `estimated` 数据可以入库，但不能替代真实观测锚点。
6. `rejected` 来源不参与校准。
7. 跨试卷比较时优先使用百分位，不直接比较不同试卷的原始分。

模型输出应区分：

```text
observedConvertedScore    // 标准卷中的真实赋分
predictedConvertedScore   // 系统预测值
confidence                // 系统置信度
```

## 5. 掌握度与不确定性

实现位置：`packages/core/src/learning/mastery-state.ts`。

旧的固定增减函数 `masteryDelta` 保留用于兼容；新的状态更新使用证据加权模型：

- 正确、错误、复习质量和曝光分别具有不同证据权重；
- 难题答对比简单题答对提供更强证据；
- 长期未练习会降低置信度，并让掌握度向 0.5 收缩，不直接归零；
- `level` 表示掌握度估计；
- `uncertainty` 表示证据不足程度；
- `evidenceCount` 表示有效证据量。

数据库兼容字段：

- `knowledge_mastery.level`
- `knowledge_mastery.uncertainty`
- `knowledge_mastery.evidence_count`
- `knowledge_mastery.mastery_version`

## 6. 批改数据闭环

数学批改结果现在可以结构化返回：

- `knowledgePoints`
- `difficulty`
- `errorType`
- `abilityAssessment`

这些字段会同步进入：

- `question_analysis`
- `practice_records`
- `wrong_questions`
- `learning_events`
- `knowledge_mastery`

如果模型没有返回新增字段，系统使用兼容默认值，不阻断原有批改链路。

## 7. 用户教育状态

用户级状态存储在 `beijing_education_states`，平台级标准卷存储在 `standard_exams` 和 `standard_exam_records`。两者都不属于 Agent Memory，也不属于 V3 active 知识图谱。

教育状态当前只表示事实：

- `grade`
- `stage`
- `selection.status`
- `selection.subjects`
- `qualificationStatus`
- `subjectPerformance`
- `policyVersion`

当前没有主动选科提醒和院校匹配逻辑。

## 8. 数据丰富度与冷启动

`data_richness` 不再按事件次数固定增加，而是由知识点覆盖度和有效学习事件量共同计算。重复同一个知识点不会让画像快速变得“很准确”。

冷启动阶段应保留不确定性；教育状态如果是用户明确提供的事实，即使学习证据不足，也可以进入 Agent 上下文。

## 9. 数据库迁移

- `0009_learning_mastery_evidence.sql`：掌握度不确定性、证据数量和版本。
- `0010_learning_event_difficulty.sql`：学习事件难度。
- `0011_beijing_standard_exams_and_state.sql`：标准卷校准数据和北京教育状态。

## 10. 后续工作

1. 导入第一批真实标准卷 JSON，执行字段和单调性校验。
2. 用多套标准卷验证原始分到百分位、赋分区间的覆盖率。
3. 增加学科原始分预测和稳定性模型，与知识点掌握度分离。
4. 在用户主动发起选科分析时，再接入 AI 的历史数据解释层。
5. 另行设计北京学习状态知识图谱，必要时把抽取结果复用到 V3，但不合并两套职责。
