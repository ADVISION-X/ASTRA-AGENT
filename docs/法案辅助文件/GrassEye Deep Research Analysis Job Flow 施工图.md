# GrassEye Deep Research Analysis Job Flow 施工图

version: 2026-05-24  
status: blueprint  
targetLaw: `GrassEye Deep Research Analysis Job Flow 法案`  
capabilityDomain: `deep-research-analysis`  

---

## 0. 施工目标

本施工图用于实现一个新的 GrassEye Job Flow：

```txt
Deep Research Analysis
```

它的目标不是让 AI 自主思考，也不是构建通用 Agent，而是把一个用户问题变成一套可追溯、可裁决、可导出的研究流水线。

核心链路：

```txt
用户问题
  -> AI 拆解问题
  -> DOM 读取拆解回复
  -> 解析并入库子问题
  -> 逐个发送子问题独立分析
  -> DOM 读取独立分析回答
  -> 解析并入库分析回答
  -> 构建 Final Adjudication Package
  -> 发送最终裁决请求
  -> DOM 读取最终裁决报告
  -> Business PPT Secretary 直接生成可下载 PPTX
  -> 系统下载、hash、入库 export record
  -> 导出 final-report 与 AI PPTX 工件
```

一句话：

```txt
发送是动作主线。
记录是价值主线。
DOM 读取是可靠性主线。
数据库是记忆主线。
最终报告是价值体现。
Workbench 交付面是已知完成信息的查看入口。
```

---

## 1. 不做什么

本 Job Flow 明确不做：

```txt
不做 universal-agent
不做 planner
不做 mission-loop
不做 AI 自主选择下一步
不做自动买卖股票
不做投资建议执行系统
不做无证据最终判断
不做只保留最终报告的黑盒分析
```

AI 输出不能控制系统动作。  
系统动作由固定 flow 控制。  

---

## 2. 推荐目录结构

```txt
src/plugins/deep-research-analysis/
  deep-research-analysis.flow.ts
  deep-research-analysis.schema.ts
  deep-research-analysis.result.ts
  deep-research-analysis.prompts.ts
  deep-research-analysis.deck-prompt.ts
  deep-research-analysis.deck-schema.ts
  deep-research-analysis.deck-parser.ts
  deep-research-analysis.deck-stage.ts
  deep-research-analysis.deck-pptx.ts
  deep-research-analysis.prompt-contracts.ts
  deep-research-analysis.records.ts
  deep-research-analysis.parser.ts
  deep-research-analysis.conflict-matrix.ts
  deep-research-analysis.final-package.ts
  deep-research-analysis.export.ts
  deep-research-analysis.logging.ts
  index.ts

scripts/acceptance/
  deep-research-analysis-smoke.ts
  deep-research-business-deck.acceptance.ts
  deep-research-deck-secretary-boundary.acceptance.ts
  deep-research-deck-artifacts.acceptance.ts
  deep-research-deck-ui.acceptance.ts

scripts/audit/domains/deep-research-analysis/
  manifest.json
  inspector.ts

docs/法案辅助文件/
  GrassEye Deep Research Analysis Job Flow 施工图.md
```

---

## 3. Flow 总览

### 3.1 主流程

```txt
runDeepResearchAnalysis(input)
  -> createResearchJob()
  -> sendDecompositionPrompt()
  -> captureDecompositionResponse()
  -> parseDecompositionResponse()
  -> persistSubQuestions()
  -> for each subQuestion:
       sendSubQuestionAnalysisPrompt()
       captureSubQuestionAnalysisResponse()
       parseSubQuestionAnalysisResponse()
       persistSubQuestionAnalysisAnswer()
  -> buildFinalAdjudicationPackage()
  -> sendFinalAdjudicationPrompt()
  -> captureFinalAdjudicationResponse()
  -> parseFinalAdjudicationResponse()
  -> persistFinalAdjudication()
  -> runBusinessDeckPhase()
  -> exportResearchArtifacts()
  -> return result
```

## 默认 1+N+1+1 商业 PPT 决策报告流程

默认 runtime flow 必须是：

```txt
Decomposition
-> Independent Analysis for each sub-question
-> Final Adjudication
-> Business Deck Secretary
```

执行要求：

1. 用户提交问题。
2. Decomposition Prompt 由 AI 自主拆出 N 个关键问题。
3. 系统保存 subQuestions。
4. 系统串行发送每个 subQuestion 的 Independent Analysis Prompt。
5. 每个分析结果入库。
6. 系统构建 Final Adjudication Package。
7. Final Adjudication Prompt 必须裁决原问题。
8. 系统保存 final adjudication。
9. Business PPT Secretary 只基于 persisted decision package 与 final adjudication 生成 downloadable PPTX artifact。
10. 系统只下载并保存 AI 生成的 PPTX，写入 final-report.md、business-deck.ai-pptx 与 evidence/debug。

默认流程不再机械执行 positive/falsification pair。

除明确标记为 legacy_1_n_n_1 的章节外，本文所有默认实现描述都应按 1+N+1+1 执行。

### 3.2 每个阶段的共同动作

每个 AI 交互阶段都必须遵循同一套动作骨架：

```txt
buildPrompt
  -> persistPromptSnapshot
  -> sendPromptToAiWindow
  -> waitForResponseCompletion
  -> captureDomResponse
  -> persistRawDomAndRawText
  -> parseResponse
  -> persistParsedRecord
  -> emitStageTerminalLog
```

阶段边界：

```txt
CAPTURE = 是否拿到非空 AI 原始回复、rawOutputRef、rawResponseHash
PARSE = 原始回复是否能通过 Deep Research 业务 parser
PERSIST = parser 成功后的业务记录是否入库
```

AI gateway 是运输层，只负责发送、等待、读取 raw response、落 rawOutputRef、生成 rawResponseHash。  
Deep Research 调用 AI gateway 时必须使用 raw-only capture，`expectedOutputSchemaRef` 必须为 `null`。  
`promptContractId` 只能作为合同标识和审计记录保留，不得作为 gateway 阻断解析条件。  
只要 provider 返回了 raw response，CAPTURE 阶段必须完成；JSON 语法错误、字段缺失、schema 不合格必须进入对应 PARSE 阶段处理。

Business Deck Secretary 是最终裁决后的格式化阶段，它需要完整读取 persisted final package、final report 和 structured evidence references。
该阶段不得使用 `45_000` 字符上限；调用 AI Input Gateway 时必须使用 `Number.MAX_SAFE_INTEGER` 作为 no-GrassEye-text-ceiling sentinel。
GPT Web Chat 自身可把长输入处理成文件，GrassEye 不在此阶段额外截断、压缩或拒绝文本 prompt。
敏感信息排除、文件数量/大小、timeout、cooldown、tab ownership、provider proof 和 raw output proof 仍由 AI Input Gateway 负责。

## 最后 +1：AI 生成商业 PPT，系统只做交付搬运工

默认 Business Deck 主流程改为 AI PPT artifact generation：

```txt
Final Adjudication completed
-> Build PPT prompt package
-> Send to GPT Web
-> GPT generates downloadable .pptx
-> Detect PPTX artifact
-> Download PPTX
-> Persist business-deck.ai-pptx export
-> UI shows Open PPT / Download PPT
```

最后一个 `+1` 的身份是：

```txt
Business PPT Secretary
```

它不是研究员，不是裁判，不是二次分析器，不是本地模板大纲生成器。Prompt 负责约束 AI 不重新研究、不改变最终判断、不新增事实、不遗漏风险/限制/证据缺口/反转条件/被拒绝观点/references；AI 负责直接生成专业商业 PPTX；系统只负责交付层检测、下载、保存、hash、export record 和 UI 展示。

明确废除默认主流程：

```txt
GPT JSON outline -> local hard-coded PPT template
```

该旧路径只能作为 fallback：

```txt
AI PPT artifact missing or download failed
-> optional local fallback
-> status = deck_local_fallback_used
-> exportKind = business-deck.local-pptx
```

主成功条件：

```txt
status = deck_pptx_ai_generated
exportKind = business-deck.ai-pptx
filePath exists
file extension = .pptx
fileSizeBytes > 0
fileHash persisted
```

不得把以下状态当作 AI PPT completed：

```txt
deck_local_fallback_used
deck_export_partial
deck_pptx_artifact_missing
deck_pptx_download_failed
deck_pptx_invalid_file
```

### 3.3 Workbench 展示契约

Workbench 展示只消费 Deep Research public facade 返回的 persisted snapshot / timeline / export artifact，不读取插件私有文件，不重新解析 raw AI response。

`/api/deep-research-analysis/timeline` 必须足够支撑完成态展示：

```txt
job
overview.currentPhase
overview.interactionCount
overview.subQuestionCount
overview.analysisCount
overview.positiveCount
overview.falsificationCount
overview.exportCount
timeline[]
subQuestions[]
answers[]
conflictMatrix[]
finalReport
exports[]
businessDeck
```

完成态首屏必须把以下内容置于 raw JSON 之前：

```txt
final report headline
confidence
evidence gaps
reverse conditions
limitations
subQuestion / analysis / export counts
business deck artifact state
export refs and hashes
timeline evidence hashes
```

禁止：

```txt
completed 但 UI 统计显示 0
只展示 raw result record
final report 只能从 raw JSON 找
exports 成功但页面不列出 export refs
timeline 有 records 但 overview 缺失导致假空态
```

### 3.4 APP 报告阅读器与历史报告库

Deep Research 页面不是调试面板，而是报告库。

第一层入口必须是历史记录：

```txt
history list
-> selected report
-> report reader
```

历史记录至少展示：

```txt
title / question summary
status
createdAt / updatedAt
subQuestionCount
interactionCount
finalConfidence
completed / failed / review_required
```

选中报告后第一屏必须展示最终结论：

```txt
Final Conclusion
Confidence
Core Reasons
Strongest Opposing Arguments
Reverse Conditions
Business Deck Delivery
```

### 3.5 文字密集报告阅读质量

Deep Research 的主要交付物是长文本报告，UI 必须按“可阅读报告产品”施工，而不是按调试面板堆字段。

必须固化以下质量线：

```txt
report reader has a dedicated reading rhythm
final conclusion has visual priority over debug evidence
sub-question cards use adaptive grids, never fixed skinny columns
Prompt / Raw AI response / parsed JSON stay behind explicit evidence details
section cards use spacing, line-height, and contrast to create reading hierarchy
```

禁止：

```txt
四列以上把长中文内容压成窄栏
Prompt / Raw Response 默认展开刷屏
所有段落使用同一种灰白卡片导致主次不可分
最终结论与普通 debug block 同权重
只靠 raw evidence 证明页面有内容
```

对口验收必须检查 `research-reading-rhythm`、自适应 report grid、`research-debug-root`、最终结论视觉优先级样式，防止页面回归为枯燥调试流。

全流程必须按树状结构展示：

```txt
Original Question
-> Decomposition
-> Q1 Independent Analysis
-> Q2 Independent Analysis
-> ...
-> Final Adjudication
-> Business Deck
-> Evidence / Debug
```

每个 subQuestion 必须展示独立分析回答；legacy_1_n_n_1 才允许额外展示 Positive / Falsification。

Decision Card 必须继续在 Business Deck 之前，Business Deck 只能作为交付工件区追加，不能抢主结论位。

Debug / Evidence 默认折叠。raw JSON、hash、provider proof、export path 只能作为调试元数据存在，不能抢占主阅读区。

New Research 与 Report Reading 必须分离：

```txt
New Research button / collapsible form
Report history rail
Selected report reader
```

长 prompt、长 raw response、长 parsed result 必须支持 More / Show 展开，默认不全量铺开。

---

## 4. 阶段设计

说明：本章后续凡明确标注 legacy_1_n_n_1 的 positive / falsification / conflict matrix 内容，都只是历史兼容参考，不得覆盖当前 active default 1+N+1+1 实现。

### 4.1 INTAKE

输入：

```ts
type DeepResearchInput = {
  userQuestion: string;
  analysisGoal?: string;
  language: "zh-CN" | "en";
  maxSubQuestions: number;
  outputFormat: "markdown";
};
```

校验规则：

```txt
userQuestion 非空
maxSubQuestions 建议 3-12
language 必填
outputFormat 初期只支持 markdown
```

输出：

```txt
ResearchJob created
```

---

### 4.2 DECOMPOSE

发送内容：

```txt
固定拆解提示词
+ 用户原始问题
+ 输出 JSON 合同
```

AI 必须输出：

```json
{
  "mainQuestion": "...",
  "subQuestions": [
    {
      "id": "Q1",
      "title": "...",
      "questionText": "...",
      "purpose": "...",
      "scope": "...",
      "expectedAnswerShape": "..."
    }
  ]
}
```

解析成功后入库：

```txt
ResearchSubQuestion[]
```

失败处理：

```txt
parse failed -> review_required
subQuestions empty -> failed
subQuestions over maxSubQuestions -> review_required
```

---

### 4.3 INDEPENDENT ANALYSIS

每个子问题单独发送。

发送内容：

```txt
用户原始问题
+ 当前子问题
+ 独立分析提示词
+ 输出 JSON/Markdown 合同
```

AI 必须输出：

```json
{
  "subQuestionId": "Q1",
  "answer": "...",
  "keyClaims": ["..."],
  "supportingReasons": ["..."],
  "assumptions": ["..."],
  "evidenceMentions": ["..."],
  "confidence": "low | medium | high",
  "limitations": ["..."]
}
```

入库：

```txt
ResearchInteraction phase=analysis
ResearchAnswer type=analysis
```

---

### 4.4 LEGACY TARGETED CHALLENGE / FALSIFICATION

仅用于 `legacy_1_n_n_1` 或未来明确命名的 targeted challenge flow，不属于默认 1+N+1+1。

每个正向回答单独发送。

发送内容：

```txt
用户原始问题
+ 当前子问题
+ 正向 AI 回答
+ 证伪提示词
+ 输出合同
```

AI 必须输出：

```json
{
  "subQuestionId": "Q1",
  "falsificationSummary": "...",
  "logicalWeaknesses": ["..."],
  "missingEvidence": ["..."],
  "counterArguments": ["..."],
  "overstatedClaims": ["..."],
  "ignoredRisks": ["..."],
  "alternativeInterpretations": ["..."],
  "whatWouldDisprovePositiveAnswer": ["..."],
  "falsificationStrength": "weak | medium | strong"
}
```

入库：

```txt
ResearchInteraction phase=falsify
ResearchAnswer type=falsification
```

---

### 4.5 LEGACY 1+N+N+1 CONFLICT MATRIX

legacy_1_n_n_1, not default.

系统从数据库生成，不让 AI 凭空生成。

输入：

```txt
ResearchSubQuestion[]
PositiveAnswer[]
FalsificationAnswer[]
```

输出：

```json
{
  "rows": [
    {
      "subQuestionId": "Q1",
      "positiveClaimSummary": "...",
      "falsificationSummary": "...",
      "conflictLevel": "low | medium | high",
      "evidenceGap": "...",
      "needsHumanReview": false
    }
  ]
}
```

注意：

```txt
初期 conflictLevel 可以由简单规则生成。
后续可以让 AI 参与整理，但 AI 输出必须入库，不能直接覆盖系统矩阵。
```

---

### 4.6 FINAL ADJUDICATION

发送内容：

```txt
最终裁决提示词
+ 用户原始问题
+ 子问题列表
+ 每题独立分析回答
+ analysis coverage
+ 输出合同
```

AI 必须输出：

```json
{
  "directAnswer": "...",
  "finalVerdict": "...",
  "confidence": "low | medium | high",
  "rankedConclusions": ["..."],
  "strongConclusions": ["..."],
  "conditionalConclusions": ["..."],
  "weakOrRejectedClaims": ["..."],
  "decisiveReasons": ["..."],
  "evidenceGaps": ["..."],
  "reverseConditions": ["..."],
  "multiStageValueAdded": ["..."],
  "limitations": ["..."]
}
```

必须包含：

```txt
直接裁决
排序结论
弱化或排除的观点
证据缺口
反转条件
多阶段研究额外价值
limitations
```

缺少任何一项不得 completed。

---

### 4.7 EXPORT

导出文件：

```txt
final-report.md
research-bundle.json
business-deck-outline.json
business-deck.pptx
evidence-index.json
```

#### final-report.md

唯一的人读报告。

它不是 summary-only markdown，而是完整全流程报告。

最小结构：

```md
# Deep Research Full Flow Report

Job ID:
Created At:
Updated At:
Status:
Question:
Analysis Goal:
Language:
Max SubQuestions:

## Final Adjudication

## Business Deck Artifact State

## Stage Overview

## Stage 1: Decomposition

## Sub-question Q1: ...
### Independent Analysis

## Sub-question Q2: ...
### Independent Analysis

## Final Adjudication Prompt / Raw Response

## Business Deck Prompt / Raw Response / Export State

## Evidence Index
```

#### research-bundle.json

面向机器复盘。

包含：

```json
{
  "jobId": "...",
  "userQuestion": "...",
  "promptVersions": {},
  "subQuestions": [],
  "analysisAnswers": [],
  "finalReport": {},
  "recordHashes": {},
  "exportedAt": "..."
}
```

#### evidence-index.json

面向审计。

包含：

```json
{
  "jobId": "...",
  "interactions": [
    {
      "interactionId": "...",
      "phase": "...",
      "promptHash": "...",
      "rawResponseHash": "...",
      "parsedRecordId": "...",
      "domRef": "..."
    }
  ]
}
```

## 唯一人读全流程报告

1. `final-report.md` 是唯一的人读报告。
2. 新 job 的默认报告必须展示完整 `1 + N + 1 + 1` 全流程，而不是只放最终摘要。
3. 报告必须按阶段组织，不能把 prompt、raw response、parsed summary 和 evidence 平铺成一坨。
4. 每个阶段必须包含：Prompt、AI Raw Response、Parsed Summary、Evidence。
5. 每个 sub-question 必须展示独立分析，不再默认展示 Positive / Falsification 成对区块。
6. Final Adjudication 也必须展示 prompt 和 raw response。
7. Business Deck 若已生成，报告与交付面必须展示 outline / PPTX refs、hash、warnings 与 failure state。
8. Evidence Index 必须放在报告末尾，供人快速追溯 interaction / hash / domRef。
8. legacy_1_n_n_1 job 可以保留 Positive / Falsification / Conflict Matrix 展示，但必须显式标记 legacy。
9. `research-bundle.json`、`business-deck-outline.json`、`business-deck.pptx` 和 `evidence-index.json` 是交付/机器证据，不是第二份人读报告。

---

## 5. 数据库模型建议

### 5.1 ResearchJob

```ts
type ResearchJob = {
  id: string;
  userQuestion: string;
  analysisGoal?: string;
  language: string;
  status:
    | "created"
    | "decomposing"
    | "decomposed"
    | "positive_running"
    | "positive_completed"
    | "falsification_running"
    | "falsification_completed"
    | "finalizing"
    | "final_completed"
    | "exported"
    | "review_required"
    | "failed";
  createdAt: string;
  updatedAt: string;
  finalReportId?: string;
};
```

### 5.2 ResearchSubQuestion

```ts
type ResearchSubQuestion = {
  id: string;
  modelQuestionId: string;
  jobId: string;
  order: number;
  title: string;
  questionText: string;
  purpose: string;
  scope: string;
  expectedAnswerShape: string;
  status: "created" | "positive_completed" | "falsified" | "review_required" | "failed";
};
```

身份边界：

```txt
id = 系统生成的数据库主键，例如 deep_research_sub_question_xxx
modelQuestionId = AI 返回的局部编号，例如 Q1 / Q2 / SQ1
question.id = 展示用模型编号，必须等于 modelQuestionId
```

`research_sub_questions.id` 是全库唯一主键，禁止使用 AI 输出的 `Q1/Q2` 作为主键。  
AI 输出 ID 只能作为 job 内局部业务编号保存到 `model_question_id`。

SQLite 约束：

```sql
id TEXT PRIMARY KEY
model_question_id TEXT NOT NULL
UNIQUE(job_id, model_question_id)
UNIQUE(job_id, ordinal)
```

迁移要求：

```txt
旧表如果没有 model_question_id：
1. 创建 research_sub_questions_v2。
2. 每条旧记录生成新的 deep_research_sub_question_xxx。
3. old.id 写入 model_question_id。
4. answers / interactions / conflict_matrix 的 sub_question_id 同 job 内 remap 到新系统 ID。
5. drop old table，rename v2。
```

后续 positive / falsification / conflict matrix 的内部关联必须使用数据库 `ResearchSubQuestion.id`。  
Prompt 和 UI 展示 Q1/Q2 时使用 `ResearchSubQuestion.question.id` 或 `modelQuestionId`。

### 5.3 ResearchInteraction

```ts
type ResearchInteraction = {
  id: string;
  jobId: string;
  subQuestionId?: string;
  phase: "decompose" | "positive" | "falsify" | "final";
  promptId: string;
  promptVersion: string;
  promptText: string;
  promptHash: string;
  aiProvider: string;
  windowRef?: string;
  sentAt: string;
  responseDetectedAt?: string;
  rawDomRef?: string;
  rawResponseText?: string;
  rawResponseHash?: string;
  parseStatus: "parsed" | "partial_review_required" | "failed";
  parsedRecordId?: string;
  failureClass?: string;
  errorReason?: string;
};
```

### 5.4 ResearchAnswer

```ts
type ResearchAnswer = {
  id: string;
  jobId: string;
  subQuestionId?: string;
  interactionId: string;
  answerType: "decomposition" | "positive" | "falsification" | "final";
  parsedJson: unknown;
  markdownSummary?: string;
  createdAt: string;
};
```

### 5.5 ResearchExport

```ts
type ResearchExport = {
  id: string;
  jobId: string;
  finalReportPath: string;
  researchBundlePath: string;
  evidenceIndexPath: string;
  finalReportHash: string;
  researchBundleHash: string;
  evidenceIndexHash: string;
  exportedAt: string;
};
```

---

## 6. Prompt 设计

### 6.1 拆解 Prompt

```txt
你是问题拆解员。

任务：
把用户的问题拆解为多个可独立研究的子问题。

要求：
1. 不回答原问题。
2. 不下最终结论。
3. 只输出结构化拆解结果。
4. 子问题必须覆盖不同分析维度。
5. 每个子问题必须能被独立发送给 AI 研究。
6. 输出 JSON。

用户问题：
{{USER_QUESTION}}

输出格式：
{
  "mainQuestion": "...",
  "subQuestions": [
    {
      "id": "Q1",
      "title": "...",
      "questionText": "...",
      "purpose": "...",
      "scope": "...",
      "expectedAnswerShape": "..."
    }
  ]
}
```

### 6.2 正向分析 Prompt

```txt
你是正方研究员。

任务：
只围绕当前子问题做正向分析。

禁止：
1. 不要回答其他子问题。
2. 不要生成最终报告。
3. 不要给交易指令。
4. 不要跳过证据与假设。

用户原始问题：
{{USER_QUESTION}}

当前子问题：
{{SUB_QUESTION}}

输出格式：
{
  "subQuestionId": "{{SUB_QUESTION_ID}}",
  "answer": "...",
  "keyClaims": ["..."],
  "supportingReasons": ["..."],
  "assumptions": ["..."],
  "evidenceMentions": ["..."],
  "confidence": "low | medium | high",
  "limitations": ["..."]
}
```

### 6.3 证伪 Prompt

```txt
你是反方质疑员。

任务：
质疑下面的正向分析，找出逻辑漏洞、证据不足、相反解释、忽略风险和过度推断。

禁止：
1. 不要重新做正向分析。
2. 不要直接给最终结论。
3. 不要无理由反对。
4. 所有质疑必须指向正向回答中的具体内容。

用户原始问题：
{{USER_QUESTION}}

当前子问题：
{{SUB_QUESTION}}

正向回答：
{{POSITIVE_ANSWER}}

输出格式：
{
  "subQuestionId": "{{SUB_QUESTION_ID}}",
  "falsificationSummary": "...",
  "logicalWeaknesses": ["..."],
  "missingEvidence": ["..."],
  "counterArguments": ["..."],
  "overstatedClaims": ["..."],
  "ignoredRisks": ["..."],
  "alternativeInterpretations": ["..."],
  "whatWouldDisprovePositiveAnswer": ["..."],
  "falsificationStrength": "weak | medium | strong"
}
```

### 6.4 最终综合 Prompt

```txt
你是最终裁判员。

任务：
基于已完成的问题拆解、正向分析、反向证伪和冲突矩阵，生成最终研究报告。

禁止：
1. 不得忽略反方证伪。
2. 不得制造不存在的证据。
3. 不得给出绝对确定结论。
4. 不得输出交易指令。
5. 必须写明反转条件和局限性。

用户原始问题：
{{USER_QUESTION}}

问题拆解：
{{SUB_QUESTIONS}}

正向回答：
{{POSITIVE_ANSWERS}}

反向证伪：
{{FALSIFICATION_ANSWERS}}

冲突矩阵：
{{CONFLICT_MATRIX}}

输出格式：
{
  "executiveSummary": "...",
  "finalJudgment": "...",
  "confidenceLevel": "low | medium | high",
  "supportingReasons": ["..."],
  "strongestOpposingArguments": ["..."],
  "conflictMatrixSummary": "...",
  "keyAssumptions": ["..."],
  "evidenceGaps": ["..."],
  "reverseConditions": ["..."],
  "followUpSignals": ["..."],
  "limitations": ["..."]
}
```

---

## 7. 能力组调用边界

### 7.1 允许调用

```txt
ai-input-gateway
dom-automation
forensics-persistence
runtime-logs
storage
```

### 7.2 禁止调用

```txt
任何其他 job flow 私有文件
任何 capability private runtime 文件
任何 planner / mission-loop / universal-agent
```

### 7.3 业务判断归属

```txt
deep-research-analysis.flow.ts
```

能力组只做同类能力，不做业务判断。

### 7.4 Raw Capture 与业务 Parser 边界

```txt
Prompt 负责尽量约束 AI 输出。
AI gateway 负责拿回 raw response。
Deep Research parser 负责 JSON 提取、合同校验、失败归类。
Records / runtime logs 负责保存证据链和阶段定位。
```

禁止：

```txt
AI gateway 因 JSON.parse 失败把 Deep Research CAPTURE 标为 failed
AI gateway 替 Deep Research 判断 confidence、字段完整性、业务合同
有 rawOutputRef / rawResponseHash 但不进入 Deep Research PARSE
```

允许：

```txt
provider 无回复、登录失效、验证码、安全校验、页面恢复失败 -> CAPTURE failed/review_required
provider 有 raw response 但 JSON 损坏 -> CAPTURE completed，PARSE failed/review_required
provider 有 raw response 且 schema 不合格 -> CAPTURE completed，PARSE failed/review_required
```

---

## 8. Runtime Log 设计

每个阶段必须有：

```txt
stage.start
stage.complete | stage.fail | stage.reviewRequired
```

关键事件：

```txt
DEEP_RESEARCH_JOB_STARTED
DEEP_RESEARCH_PROMPT_SENT
DEEP_RESEARCH_DOM_CAPTURE_STARTED
DEEP_RESEARCH_DOM_CAPTURE_COMPLETED
DEEP_RESEARCH_PARSE_COMPLETED
DEEP_RESEARCH_PARSE_FAILED
DEEP_RESEARCH_RECORD_PERSISTED
DEEP_RESEARCH_FINAL_PACKAGE_BUILT
DEEP_RESEARCH_EXPORT_COMPLETED
DEEP_RESEARCH_JOB_COMPLETED
DEEP_RESEARCH_JOB_FAILED
```

失败必须包含：

```txt
failureClass
phase
interactionId
reason
retryable
terminal
actionableMessage
```

---

## 9. 验收路径

## Smoke 活体链路验收

Smoke 是 Deep Research Analysis 的最小活体链路验收。

它的职责不是证明所有法案边界，而是证明最小业务主链真实可运行。

### Smoke 与 Inspector 分工

```txt
Inspector / Audit:
  静态执法链路
  负责 AST、symbol、反逃逸、owner boundary、prompt scatter、parser honesty、runtime log contract

Smoke / Acceptance:
  活体运行链路
  负责证明最小 Job Flow 从输入到导出真实跑通
```

### Deep Research Smoke 最小路径

```txt
create ResearchJob
-> render decomposition prompt
-> feed raw decomposition response fixture
-> parse decomposition
-> persist subQuestions
-> render positive prompt
-> feed raw positive response fixture
-> parse positive answer
-> persist positive answer
-> render falsification prompt
-> feed raw falsification response fixture
-> parse falsification answer
-> persist falsification answer
-> build conflict matrix
-> build final package from persisted records
-> feed raw final report response fixture
-> parse final report
-> persist final report
-> export final-report.md
-> export research-bundle.json
-> export evidence-index.json
-> verify runtime log started/terminal events
```

### Fixture 使用边界

Fixture 只允许模拟外部 AI raw response。

允许：

```txt
fixture raw response
-> parser
-> records
-> final package
-> export
```

禁止：

```txt
fixture parsed object
-> direct success
```

禁止绕过：

```txt
parser
quality scorer
records
falsification
conflict matrix
final package
export
runtime log
```

### Smoke 文件建议

```txt
scripts/acceptance/deep-research-analysis-smoke.ts
```

可选专项 acceptance：

```txt
scripts/acceptance/deep-research-decomposition-prompt.acceptance.ts
scripts/acceptance/deep-research-final-report.acceptance.ts
scripts/acceptance/deep-research-export.acceptance.ts
```

### CI 接入

允许新增 package script：

```json
{
  "acceptance:deep-research-analysis-smoke": "node --import tsx scripts/acceptance/deep-research-analysis-smoke.ts"
}
```

但该脚本必须被 `ci:full` 调用。  
不得建立第二套完整质检入口。

### Smoke PASS 条件

```txt
1. Job 创建成功。
2. Decomposition prompt 渲染成功。
3. Decomposition raw response 经 parser 解析成功。
4. SubQuestions 入库成功。
5. Positive raw response 经 parser 解析成功。
6. Positive answer 入库成功。
7. Falsification raw response 经 parser 解析成功。
8. Falsification answer 入库成功。
9. Conflict matrix 构建成功。
10. Final package 从 persisted records 构建成功。
11. Final report parser 成功。
12. Final report 入库成功。
13. final-report.md 导出成功。
14. research-bundle.json 导出成功。
15. evidence-index.json 导出成功。
16. runtime log 有 started 和 terminal event。
```

### Smoke FAIL 条件

```txt
parse failed
quality score failed
DB persist failed
falsification missing
conflict matrix missing
final package not from persisted records
export file missing
export hash missing
runtime log terminal missing
catch swallowed error
```

### Raw Capture Boundary 验收

Smoke 必须包含一个畸形 provider JSON 用例：

```txt
Decomposition fixture 合格
Positive fixture 返回非空 raw response，但 JSON 故意缺少闭合括号
```

期望：

```txt
POSITIVE_CAPTURE completed
POSITIVE_PARSE failed
result.phase = POSITIVE_PARSE
failureReason = json_parse_failed:...
```

禁止：

```txt
AI feed output failed requested parsing.
result.phase = POSITIVE_CAPTURE
```

### GPT Web Chat 会话隔离

Deep Research 阶段执行是串行的：

```txt
SEND -> CAPTURE -> PARSE -> PERSIST -> next prompt
```

GPT web-chat 传输还必须做到每个 prompt exchange 独立会话：

```txt
Decomposition -> click 新聊天 -> paste -> Return -> wait response
Q1 Positive -> click 新聊天 -> paste -> Return -> wait response
Q1 Falsification -> click 新聊天 -> paste -> Return -> wait response
Q2 Positive -> click 新聊天 -> paste -> Return -> wait response
...
Final Synthesis -> click 新聊天 -> paste -> Return -> wait response
```

不得把 positive、falsification、final synthesis 连续塞进同一个 ChatGPT conversation。  
实测基线：同一 ChatGPT 会话能回忆上一条随机 marker；点击“新聊天”后，新会话对旧 marker 只能返回 UNKNOWN。

### Confidence 输出合同

Positive、Falsification、Final Synthesis 三类 JSON 输出应优先使用：

```txt
"low" | "medium" | "high"
```

但 runtime parser 必须接受并归一化这些常见变体：

```txt
0.8
80
"80%"
"high confidence"
"较高"
```

parser 必须先尝试归一化；只有无法判断 confidence 时，才允许 `PARSE failed / review_required`。  
prompt 必须明确写入：

```txt
Prioritize analytical content over perfect formatting.
confidence may be low/medium/high, a numeric score, or a percentage; the system will normalize it.
If a preferred field is unavailable, omit it instead of inventing evidence.
```

实测基线：旧 positive prompt 曾让 GPT 返回 `"confidence": 0.68` 并在 `POSITIVE_PARSE` 被 parser 拒绝；当前 runtime 必须把这类格式差异视为 PARSE 内部归一化责任，而不是把内容价值直接判死。

### Single Sub-question Fault Isolation

Deep Research 必须把单题失败隔离在 sub-question 边界：

```txt
Q1 success
Q2 positive parse failed
Q3 success
-> final package continues when minimum material exists
-> final report surfaces evidence gaps for the missing structured sub-question
```

规则：

```txt
当前 sub-question parse failed != 整个 job 立即 failed
single sub-question failed != 剩余 sub-questions停止
no complete positive/falsification pair -> FINAL_PACKAGE_BUILD review_required
system-built conflictMatrix 已存在时，AI final report 可以不重复输出完整 conflictMatrix
```

### Phase 1：无浏览器假数据 smoke

目的：验证 schema、parser、db、export。

```txt
mock AI raw response fixture
-> parser
-> db record
-> final package
-> export
```

注意：fixture 只能在 acceptance 里存在，不能进入 production path。

### Phase 2：真实 AI 窗口发送 smoke

目的：验证发送、DOM 读取、解析、入库。

```txt
send decomposition prompt
capture response
parse subQuestions
persist
```

### Phase 3：完整最小链路

使用 2 个子问题即可：

```txt
decompose
-> Q1 positive
-> Q1 falsify
-> Q2 positive
-> Q2 falsify
-> final synthesis
-> export
```

---

## 10. 审计规则

Deep Research inspector 必须检查：

```txt
1. Job 目录存在。
2. flow/schema/result/index 存在。
3. active 代码中没有 planner / nextAction / actionPlan / mission-loop / universal-agent。
4. prompt 只能集中在 prompts 文件。
5. final package 构造必须读取 persisted records。
6. 同一 subQuestion 的 parse failed 不得伪装为 success；剩余 subQuestions 可继续，只有 minimum material gate 才能阻断 final path。
7. 每个 interaction 必须记录 promptHash 和 rawResponseHash。
8. final report 允许回退到系统构造的 conflictMatrix / evidenceGaps；不得强迫 AI 重新复制系统已知结构。
9. export 必须生成三件套。
10. runtime log 必须覆盖 stage start/terminal。
11. Deep Research 调用 AI gateway 必须传 expectedOutputSchemaRef: null。
12. Smoke 必须证明 malformed raw JSON 是 POSITIVE_PARSE 失败，不是 POSITIVE_CAPTURE 失败。
13. Smoke 必须证明单个 sub-question parse 失败不会直接杀死整条研究链，并且 final report 会出现对应 evidence gap。
```

---

## 11. 实施顺序

### 第一步：只建法案和施工图

```txt
module-deep-research-analysis.instructions.md
GrassEye Deep Research Analysis Job Flow 施工图.md
```

### 第二步：建 schema 和 result contract

```txt
deep-research-analysis.schema.ts
deep-research-analysis.result.ts
```

### 第三步：建 prompts 和 parser

```txt
deep-research-analysis.prompts.ts
deep-research-analysis.parser.ts
```

### 第四步：建 records 和 storage

```txt
deep-research-analysis.records.ts
```

### 第五步：建 flow skeleton

```txt
deep-research-analysis.flow.ts
```

### 第六步：建 acceptance

```txt
deep-research-analysis-smoke.ts
```

### 第七步：建 inspector

```txt
scripts/audit/domains/deep-research-analysis/inspector.ts
```

---

## 12. 最终价值定义

本 Job Flow 的最终价值不是中间任何一次 AI 回复。

最终价值是：

```txt
final-report.md
```

但 final-report.md 的可信度来自：

```txt
research-bundle.json
evidence-index.json
database records
runtime logs
raw DOM refs
raw response hashes
prompt hashes
```

没有证据链的最终报告，不是 Deep Research Analysis 的合格产物。
