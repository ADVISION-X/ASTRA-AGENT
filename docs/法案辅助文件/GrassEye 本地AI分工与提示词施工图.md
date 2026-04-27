# 《GrassEye 本地AI分工与提示词施工图》

## 基本身份

- 从属权威：
  - .github/instructions/cursor-rules/GRASSEYE-KERNEL.instructions.md
  - .github/instructions/cursor-rules/modules/module-local-ai-runtime.instructions.md
  - .github/instructions/cursor-rules/modules/module-vision-boundary.instructions.md
  - .github/instructions/cursor-rules/modules/module-comment-intelligence.instructions.md
  - .github/instructions/cursor-rules/modules/module-product-signal.instructions.md
  - .github/instructions/cursor-rules/modules/module-type-safety.instructions.md
  - .github/instructions/cursor-rules/modules/module-security-privacy.instructions.md
- 角色：本地 AI 分工、调用链、提示词与输出契约的建造级落地映射，不是第二法案
- 原则：疑问以上位法案为准；本图可删减，不改法案成立性
- 版本：1.0

## 范围声明

本施工图只服务 GrassEye 第一阶段的本地 AI 分工、模型角色、prompt registry、输出 schema、调用顺序和验收映射。

本施工图不服务：
- 模型安装教程
- 真实模型 API 实现
- 付费 API 接入
- 云端 AI fallback
- 浏览器点击动作
- OCR 底层算法实现
- 数据库 schema
- UI 页面
- 最终选品决策

## 一句话原则

GrassEye 第一阶段 AI 主链本地执行；模型按任务分工，提示词版本化，输出结构化，失败进入 skip / retry / operator review，不自动转云端或付费 API。

## 本地 AI 角色矩阵

| AI 角色 | 归属边界 | 输入 | 输出 | 不应承担 |
| --- | --- | --- | --- | --- |
| Vision Model | vision-boundary + local-ai-runtime | 视频区域截图 | 内容分类、置信度、理由、建议动作 | 评论理解、最终选品、采购建议 |
| OCR Engine | comment-intelligence + local-ai-runtime | 评论区截图 | OCR 文本、位置/段落信息、置信度 | 购买意图判断、个人画像 |
| Comment Understanding Model | comment-intelligence + local-ai-runtime | 清洗后的评论文本 | 购买意图、痛点、质疑、需求词 | 编造评论、追踪个人 |
| Product Signal Model | product-signal + local-ai-runtime | 视频证据、评论信号、AI 中间结果 | 候选机会摘要、初步评分、风险 | 最终采购、上架、广告决策 |
| Prompt Registry | local-ai-runtime | task type、schema version、prompt version | 受控 prompt contract | 散落业务代码、混合多任务 |
| Local AI Gateway | local-ai-runtime | 任务请求 | 结构化 AI 输出 | 平台动作、UI 决策、数据真相 |

## 调用链矩阵

| 阶段 | 调用者 | 本地 AI 角色 | 输入证据 | 输出 contract | 失败处理 |
| --- | --- | --- | --- | --- | --- |
| 视频判断 | AgentRuntime | Vision Model | video screenshot | VisionClassificationResult | skip / retry / operator review |
| 评论识别 | Comment Intelligence | OCR Engine | comment screenshot | OcrTextResult | retry / operator review |
| 评论理解 | Comment Intelligence | Comment Understanding Model | cleaned OCR text | CommentSignalResult | skip / operator review |
| 产品机会 | Product Signal | Product Signal Model | evidence bundle | ProductOpportunityCandidate | candidate only / operator review |

## Prompt Registry 矩阵

| Prompt 类型 | 任务 | 输入范围 | 输出 schema | 禁止输出 |
| --- | --- | --- | --- | --- |
| vision.productPresence.v1 | 判断当前截图是否明确展示具体产品 | 当前视频区域截图 | isProductVideo / confidence / visibleProductTypes / evidenceObservations / suggestedNextAction | 利润、采购、广告、爆款、最终商业结论 |
| comments.ocr_cleanup.v1 | 清洗 OCR 评论文本 | OCR 文本 | cleanedComments / uncertainText / confidence | 编造评论、补写不存在文本 |
| comments.intent_analysis.v1 | 分析评论购买意图 | cleaned comments | purchaseIntent / painPoints / complaints / demandTerms | 个人画像、跨评论追踪 |
| product.signal_summary.v1 | 生成产品机会候选 | evidence bundle | category / useCase / painPoint / score / risk / evidenceRefs | 采购决定、广告决定、上架决定 |

## 输出记录字段矩阵

| 字段 | 作用 | 是否必需 |
| --- | --- | --- |
| taskType | 标识 AI 任务类型 | 是 |
| modelRole | 标识模型角色 | 是 |
| promptVersion | 标识提示词版本 | 是 |
| schemaVersion | 标识输出 schema | 是 |
| evidenceRef | 绑定截图 / OCR / 评论证据 | 是 |
| confidence | 标识置信度或不确定性 | 是 |
| result | 结构化输出 | 是 |
| rawText | 可选调试留痕 | 可选，需最小化 |
| error | 失败原因 | 失败时必需 |

## 本地失败处理矩阵

| 失败类型 | 处理方向 | 不应发生 |
| --- | --- | --- |
| 本地模型不可用 | retry / operator review | 自动转云端 API |
| OCR 置信度低 | 标记 uncertain / review | 编造文字 |
| Vision 低置信度 | skip / review | 强行动作 |
| Product Signal 不确定 | candidate 降权 / review | 给出最终选品结论 |
| Prompt schema 不匹配 | reject / repair / review | 直接写入 downstream |

## 验收线

| 验收对象 | 建对表现 | 漂移信号 |
| --- | --- | --- |
| Local AI Gateway | AI 调用集中，任务可追踪 | 各 feature 里散落模型调用 |
| Prompt Registry | prompt 有任务、版本、schema | prompt 字符串到处写 |
| Vision Model | 只输出分类与建议动作 | 直接给商业结论 |
| OCR / Comment | 有证据、有清洗、有不确定性 | 编造评论或保存个人画像 |
| Product Signal | 只生成候选机会 | 自动采购、上架、投放 |
| External API | 默认不调用 | 本地失败后静默调用付费 API |

## 冷路径说明

- 后续如果需要云端 AI，只能作为单独受控能力重新审查，不得静默进入第一阶段主链。
- 施工图可以删减，不影响法案成立。
- 若施工图与法案冲突，以上位法案为准。

## 结束语

本施工图只把本地 AI 的分工、提示词、调用链和验收结构说清，不新增权威，不替代法案，不提前实现模型调用。