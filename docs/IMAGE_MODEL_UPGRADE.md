# 图像模型链路升级记录

更新时间：2026-08-11

## 结论

当前图像系统不是“模型直接画图片”，而是：

1. 文本模型把题目转换成结构化 Visual AST；
2. Schema 与 eval 校验 AST；
3. iOS `Canvas` 渲染 AST。

因此，`geometry`、`chart`、`circuit`、`pedigree`、`graph`、`lab`、`cell` 这些任务的核心不是生成图片 URL，而是稳定地产生可渲染 JSON。

## 本次升级

- DeepSeek 旧模型别名替换为当前可用的 `deepseek-v4-flash` 与 `deepseek-v4-pro`。
- 温度 `<= 0.1` 的结构化/视觉 AST 任务使用 `deepseek-v4-pro`。
- 普通分析和对话使用 `deepseek-v4-flash`。
- 两个 v4 模型均启用 JSON mode。
- `tryParseJson` 增加模型偶尔输出前置说明或代码围栏时的平衡对象/数组恢复，但仍由 Zod schema 做最终校验。
- 结构化调用现在会对“JSON 解析失败”和“Schema 校验失败”统一执行一次低温纠错重试；重试仍必须通过原始 Zod schema。
- 细胞跨膜运输提示词收紧：出现跨膜/扩散/进入/排出等语义时，必须输出完整 `transport` 事件，不得省略方向或运输方式。
- API 用量记录加入 v4 的 cache-miss 计费档位，避免升级后成本统计归零。

## 基线与回归

在当前 DeepSeek 账号上完成真实回归（2026-08-11）：

| 链路 | 结果 |
|---|---:|
| Geometry | 15/15 通过 |
| Lab | 4/5 通过，整体达到 80% 门槛 |
| Cell | 5/5 通过，100% |
| Cell JSON 容错单测 | 6/6 |
| 用量计费单测 | 6/6 |

本轮第一次 Lab 真跑中出现一次非法 JSON，原实现会直接失败；加入解析失败重试后，第二次完整 Lab eval 恢复为 4/5（达到套件门槛）。剩余差距来自氧气制备/蒸馏装置的器材与连接语义匹配，不是 JSON 崩溃。

## 多模态边界

真正“看图片”的链路是 `analyzeImg`，当前通过 DashScope VL provider 连接 `qwen-vl-max`。它与文字题生成 `cell`/`lab`/`geometry` AST 是两条不同路径。

当前工作区没有有效的 `DASHSCOPE_API_KEY`，所以本轮完成了文本 AST 生成升级和 JSON 稳定性升级，但还没有做“渲染截图 → 多模态视觉复核 → AST 修正”的闭环。

下一阶段接入有效视觉模型 key 后，建议增加：

- iOS/离线渲染截图；
- 多模态 critic 检查越界、重叠、标签遮挡、箭头方向；
- critic 只返回修正建议，再由 schema/renderer 应用有限修复；
- 单独记录“语义正确率”和“视觉可读率”。
