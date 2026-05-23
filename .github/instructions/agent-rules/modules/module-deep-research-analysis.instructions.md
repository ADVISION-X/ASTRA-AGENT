---
name: "GrassEye Deep Research Analysis Job Flow"
description: "Governs the Deep Research Analysis job flow: AI-driven decomposition, positive analysis, falsification, final synthesis, DOM capture, parsing, persistence, evidence, logs, and export. This law keeps the job as a fixed research pipeline, not a planner, mission loop, or universal agent."
applyTo: "src/plugins/deep-research-analysis/**, src/mediator/**, src/capabilities/**, src/lib/runtime-logs/**, scripts/acceptance/**, scripts/audit/**, .github/instructions/agent-rules/**"
---

# GrassEye Deep Research Analysis Job Flow 法案

status: active  
version: 2026-05-23  
capabilityDomain: deep-research-analysis  
tier: P0  
enforcementMode: machine-blocking  
evidenceMode: law + schema + fs + ast + runtime-log + persisted-record  

---

## 0. 身份定义

Deep Research Analysis 是 GrassEye 的一个固定业务 Job Flow。

它不是 universal agent。  
它不是 planner。  
它不是 mission-loop。  
它不是 AI 自主决策系统。  
它不是股票预测神谕。  
它不是让 AI 自己决定下一步的通用研究机器人。

它的唯一身份是：

```txt
用户问题
  -> AI 拆解
  -> 子问题入库
  -> 子问题正向分析
  -> 正向回答入库
  -> 子问题反向证伪
  -> 证伪回答入库
  -> 最终综合报告
  -> 最终报告入库与文件导出
```

本 Job Flow 的核心价值不是 AI 自己“思考”，而是：

```txt
固定提示词发送
DOM 回复读取
结构化解析
数据库记录
证据保存
日志闭环
最终报告导出
```

一句话：

```txt
AI 是外部研究员；GrassEye 是研究流程管理器、证据记录器和报告生产线。
```

---

## 1. 架构归属

Deep Research Analysis 必须作为独立 Job Flow 落位：

```txt
src/plugins/deep-research-analysis/
```

允许新增：

```txt
src/plugins/deep-research-analysis/deep-research-analysis.flow.ts
src/plugins/deep-research-analysis/deep-research-analysis.schema.ts
src/plugins/deep-research-analysis/deep-research-analysis.result.ts
src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts
src/plugins/deep-research-analysis/deep-research-analysis.records.ts
src/plugins/deep-research-analysis/deep-research-analysis.parser.ts
src/plugins/deep-research-analysis/deep-research-analysis.export.ts
src/plugins/deep-research-analysis/index.ts
scripts/acceptance/deep-research-analysis-smoke.ts
scripts/audit/domains/deep-research-analysis/manifest.json
scripts/audit/domains/deep-research-analysis/inspector.ts
```

禁止：

```txt
src/orchestration/**
src/planner/**
src/agents/**
src/agent/**
src/mission-loop/**
src/nerve-bus/**
src/universal-agent/**
src/lib/deep-research-business/**
```

业务逻辑不得进入 `src/lib/**`。  
能力组不得吸收本 Job 的业务阶段。  
中介层只允许识别 job type、校验输入、调用 flow、返回 result。  

---

## 2. 固定阶段

本 Job Flow 只允许以下固定阶段：

```txt
INTAKE
DECOMPOSE_SEND
DECOMPOSE_CAPTURE
DECOMPOSE_PARSE
DECOMPOSE_PERSIST
POSITIVE_SEND
POSITIVE_CAPTURE
POSITIVE_PARSE
POSITIVE_PERSIST
FALSIFY_SEND
FALSIFY_CAPTURE
FALSIFY_PARSE
FALSIFY_PERSIST
FINAL_PACKAGE_BUILD
FINAL_SEND
FINAL_CAPTURE
FINAL_PARSE
FINAL_PERSIST
EXPORT_REPORT
COMPLETE
```

阶段顺序必须由 flow 固定控制。  
AI 只能回答当前阶段的问题，不得决定下一阶段。  
任何阶段失败必须进入 `failed` 或 `review_required`，不得假成功。

---

## 3. 核心法条

### [GRASSEYE-DEEP-RESEARCH-001-V1] 独立 Job Flow 主权

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast",
  "summary": "Deep Research Analysis must live as one explicit job flow under src/plugins/deep-research-analysis and must not become a universal agent, planner, or mission loop."
}
```

#### 必须

- 新增独立 job schema。
- 新增独立 job flow。
- 新增独立 result contract。
- 新增 acceptance smoke。
- 新增 audit owner。
- 所有阶段由 flow 固定推进。

#### 禁止

- 使用 `planner`、`nextAction`、`actionPlan`、`missionLoop`、`universalAgent` 作为 active runtime。
- AI 生成下一步运行计划。
- 通过 AI 输出决定是否继续、跳转、重排阶段。
- 把本 Job 混入 Amazon、Facebook 或其他已有 Job Flow。

---

### [GRASSEYE-DEEP-RESEARCH-002-V1] AI 只做内容生成，不做流程决策

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-002-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+schema",
  "summary": "AI may produce decomposition, positive analysis, falsification, and final synthesis content, but must not control runtime flow."
}
```

#### AI 允许输出

```txt
decomposedSubQuestions
positiveAnalysis
falsificationAnalysis
conflictPoints
finalReport
confidence
limitations
reverseConditions
```

#### AI 禁止输出作为运行控制

```txt
nextAction
actionPlan
browserCommand
selector
coordinate
workflow
multiStepPlan
runNext
openWindow
clickTarget
databaseCommand
filePath
```

#### 规则

AI 输出可以被保存、解析、审查、投喂下一阶段。  
AI 输出不得直接变成浏览器动作、数据库动作或系统动作。  
系统动作只能由 fixed Job Flow 决定。  

---

### [GRASSEYE-DEEP-RESEARCH-003-V1] 问题拆解必须由 AI 产生并结构化入库

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-003-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "dom+parser+db",
  "summary": "The decomposition phase must send the user question and fixed decomposition prompt to AI, capture the DOM response, parse subquestions, and persist them."
}
```

#### 必须记录

```txt
jobId
interactionId
phase = decompose
promptText
userQuestion
aiProvider
windowRef
sentAt
responseDetectedAt
rawDomRef
rawResponseText
rawResponseHash
parsedSubQuestions
parseStatus
persistedRecordIds
```

#### 拆解输出必须包含

```txt
subQuestionId
order
title
questionText
purpose
scope
expectedAnswerShape
```

#### 禁止

- 人工手写子问题替代 AI 拆解。
- 只保存解析结果，不保存 raw response。
- 只保存 raw response，不保存 parsed subquestion。
- parse failed 后继续进入 positive phase。
- 让 AI 自己决定子问题执行顺序。

---

### [GRASSEYE-DEEP-RESEARCH-004-V1] 正向分析必须逐题独立发送并入库

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-004-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "dom+parser+db+runtime-log",
  "summary": "Each subquestion must be sent as an independent positive analysis interaction and persisted with raw and parsed evidence."
}
```

#### 输入必须包含

```txt
userQuestion
subQuestion
positiveAnalysisPrompt
outputContract
```

#### 入库必须包含

```txt
jobId
subQuestionId
interactionId
phase = positive
promptText
rawResponseText
rawResponseHash
parsedAnswer
keyClaims
evidenceMentions
assumptions
confidence
limitations
parseStatus
```

#### 禁止

- 多个子问题混在一个 AI 正向回答中。
- 不保存 promptText。
- 不保存 rawResponseHash。
- 正向分析失败仍进入 falsification。
- 正向分析回答被覆盖而无历史记录。

---

### [GRASSEYE-DEEP-RESEARCH-005-V1] 证伪阶段必须基于原问题、子问题和正向回答

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-005-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "dom+parser+db+runtime-log",
  "summary": "Each positive analysis must be challenged by a separate falsification interaction using the original question, subquestion, and positive answer."
}
```

#### 证伪输入必须包含

```txt
userQuestion
subQuestion
positiveAnswer
falsificationPrompt
outputContract
```

#### 证伪输出必须解析为

```txt
logicalWeaknesses
missingEvidence
counterArguments
overstatedClaims
ignoredRisks
alternativeInterpretations
whatWouldDisprovePositiveAnswer
falsificationStrength
```

#### 禁止

- 证伪阶段重新回答原题而不是质疑正向回答。
- 证伪阶段缺少 positiveAnswer。
- 证伪失败后仍把子问题标记为 completed。
- 把证伪内容当作最终结论。

---

### [GRASSEYE-DEEP-RESEARCH-006-V1] 最终报告只能基于已持久化证据包生成

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-006-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "db+artifact+hash",
  "summary": "Final synthesis must be generated from persisted decomposition, positive answers, falsification answers, and conflict matrix, not from transient memory."
}
```

#### final package 必须包含

```txt
userQuestion
decompositionRecords
positiveAnswerRecords
falsificationAnswerRecords
conflictMatrix
recordHashes
promptVersion
outputContract
```

#### 最终报告必须包含

```txt
executiveSummary
finalJudgment
confidenceLevel
supportingReasons
strongestOpposingArguments
conflictMatrixSummary
keyAssumptions
evidenceGaps
reverseConditions
followUpSignals
limitations
```

#### 禁止

- 只把 raw chat history 直接贴给最终 AI。
- 漏掉证伪报告。
- 漏掉 record hash。
- final report 无反转条件。
- final report 无 limitations。
- final report 生成后不入库。

---

### [GRASSEYE-DEEP-RESEARCH-007-V1] DOM 读取是观测，不是最终真相

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-007-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "dom+artifact+hash",
  "summary": "DOM capture is observational evidence; persisted parsed records and raw response hashes are the durable truth."
}
```

#### 必须

- 每次 DOM 读取生成 rawDomRef。
- 每次 rawResponseText 生成 hash。
- 每次 parse result 绑定 rawResponseHash。
- 每次 database record 绑定 interactionId。
- 解析失败必须保留 raw evidence。

#### 禁止

- 只看屏幕状态不保存。
- 只保存最终文本不保存 DOM 证据。
- 用旧 DOM response 当作新回答。
- 未验证回复完成就读取。
- DOM 读取失败后伪造 AI 回复。

---

### [GRASSEYE-DEEP-RESEARCH-008-V1] 数据库记录必须成为研究记忆主线

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-008-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "db+schema",
  "summary": "Every phase must persist structured records before the next phase may consume them."
}
```

#### 最小记录模型

```txt
ResearchJob
ResearchSubQuestion
ResearchInteraction
ResearchAnswer
ResearchFalsification
ResearchConflictMatrix
ResearchFinalReport
ResearchExport
```

#### 状态必须显式

```txt
created
decomposing
decomposed
positive_running
positive_completed
falsification_running
falsification_completed
finalizing
final_completed
exported
review_required
failed
```

#### 禁止

- 依赖内存数组作为跨阶段事实。
- 下一阶段直接读取上一阶段临时变量。
- 未入库先继续下一阶段。
- 失败记录缺少 failureClass。
- 更新覆盖旧记录而不保留历史。

---

### [GRASSEYE-DEEP-RESEARCH-009-V1] Prompt 必须版本化

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-009-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+db+hash",
  "summary": "All prompts used by the job must be versioned, persisted, hashable, and linked to interactions."
}
```

#### 必须版本化

```txt
decompositionPrompt
positiveAnalysisPrompt
falsificationPrompt
finalSynthesisPrompt
outputContractPrompt
```

#### 必须记录

```txt
promptId
promptVersion
promptText
promptHash
phase
interactionId
```

#### 禁止

- 在代码中散落 prompt 字符串。
- 修改 prompt 后无法追溯。
- 使用未记录 prompt 生成 final report。
- Prompt 输出格式无 schema 约束。

---

### [GRASSEYE-DEEP-RESEARCH-010-V1] 解析失败不得伪成功

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-010-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "parser+db+runtime-log",
  "summary": "Parser failure must produce review_required or failed status and must not be coerced into success."
}
```

#### parseStatus 只允许

```txt
parsed
partial_review_required
failed
```

#### 必须

- Parser 必须先做 JSON 提取、字段别名映射、confidence 归一化、以及不编造证据的本地修复，再决定 `failed` 或 `partial_review_required`。
- 只要 raw response 已经被 CAPTURE，PARSE 失败也必须落 interaction 证据记录，不得让业务层丢失原始回复。
- 单个 positive / falsification parse 失败只能阻断当前 sub-question，不得直接终止剩余 sub-questions。
- Final synthesis 允许回退到系统已持久化的 conflictMatrix 与 missingSubQuestionIds；不得强迫 AI 重新八股复制系统已知结构。

#### 禁止

- JSON parse failed 后静默改写为 success。
- 仅因 markdown fence、前后 prose、额外字段、numeric confidence 等可归一化格式差异就终止整条研究链。
- 缺少必填字段仍标记 completed。
- 用空数组作为成功拆解。
- 用空 final report 作为成功导出。

---

### [GRASSEYE-DEEP-RESEARCH-011-V1] 最终导出必须包含证据索引

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-011-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "file+hash+db",
  "summary": "Exported reports must include an evidence index that links final claims to persisted interaction records."
}
```

#### 导出文件最少包括

```txt
final-report.md
research-bundle.json
evidence-index.json
```

#### final-report.md 必须包含

```txt
主问题
最终结论
置信度
正方核心理由
反方核心质疑
冲突矩阵摘要
证据缺口
反转条件
后续观察信号
```

#### research-bundle.json 必须包含

```txt
jobId
promptVersions
subQuestions
positiveAnswers
falsificationAnswers
finalReport
recordHashes
exportedAt
```

#### 禁止

- 只导出最终报告，不导出证据索引。
- 文件导出成功但数据库未记录 export。
- export 文件无 hash。
- final report 无来源记录。

---

### [GRASSEYE-DEEP-RESEARCH-012-V1] 日志必须覆盖全链路

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-012-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "runtime-log+audit",
  "summary": "Every phase transition, send, DOM capture, parse, persist, final synthesis, and export must emit structured Runtime Log Spine events."
}
```

#### 必须记录事件

```txt
JOB_STARTED
PHASE_STARTED
AI_PROMPT_SENT
AI_RESPONSE_CAPTURE_STARTED
AI_RESPONSE_CAPTURE_COMPLETED
AI_RESPONSE_PARSE_COMPLETED
AI_RESPONSE_PARSE_FAILED
DB_RECORD_PERSISTED
FINAL_PACKAGE_BUILT
FINAL_REPORT_CAPTURED
EXPORT_COMPLETED
JOB_COMPLETED
JOB_FAILED
JOB_REVIEW_REQUIRED
```

#### 失败事件必须包含

```txt
failureClass
reason
phase
interactionId
retryable
terminal
actionableMessage
```

#### 禁止

- catch 无日志。
- 发送失败无日志。
- DOM 读取失败无日志。
- parse failed 无日志。
- DB persist failed 无日志。
- export failed 无日志。
- final report 失败后无 review_required 记录。

---

### [GRASSEYE-DEEP-RESEARCH-013-V1] Smoke 活体链路验收主权

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-013-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "acceptance+runtime-log+db+artifact",
  "summary": "Deep Research Analysis must provide a minimum smoke acceptance that proves the job flow can execute its smallest live path through parser, persistence, final package, export, and runtime logs."
}
```

#### 定义

Smoke 是 Deep Research Analysis 的最小活体链路验收。

它不是普通单元测试。  
它不是 inspector 的替代品。  
它不是完整业务覆盖。  
它不是人工手动验证。  
它不是 mock success。  

Smoke 只回答一个问题：

```txt
Deep Research Analysis 的最小主链路是否真的活着？
```

#### Smoke 必须证明

最小 smoke 必须证明以下链路可以真实跑通：

```txt
ResearchJob created
-> decomposition prompt rendered
-> raw decomposition response captured or fixture injected as raw AI output
-> decomposition parser executed
-> subQuestions persisted
-> positive prompt rendered
-> raw positive response captured or fixture injected as raw AI output
-> positive parser executed
-> positive answer persisted
-> falsification prompt rendered
-> raw falsification response captured or fixture injected as raw AI output
-> falsification parser executed
-> falsification answer persisted
-> conflict matrix built
-> final package built from persisted records
-> raw final report response captured or fixture injected as raw AI output
-> final parser executed
-> final report persisted
-> final-report.md exported
-> research-bundle.json exported
-> evidence-index.json exported
-> runtime log has started and terminal evidence
```

#### Smoke 允许

Smoke 允许使用 fixture 代替外部 AI 的真实输出。

但 fixture 只能模拟：

```txt
外部 AI raw response
```

fixture 必须从与生产相同的 raw response 入口进入。

允许：

```txt
fixture raw AI text
-> parser
-> quality scorer
-> records
-> final package
-> export
-> runtime log
```

#### Smoke 禁止

Smoke 禁止绕过以下环节：

```txt
parser
quality scorer
persistence
falsification
conflict matrix
final package
final report parser
export
runtime log
```

禁止：

```txt
直接塞 parsed result
直接标记 parse success
直接写 final report 而不构建 final package
直接写 export 文件而不入库 export record
跳过 falsification
关闭 runtime log
catch 后返回 success
fixture 走 production mock path
```

#### Smoke 与 Inspector 的关系

Deep Research Analysis 必须同时具备：

```txt
静态执法链：inspector / audit / ts-morph / AST / symbol / anti-evasion
活体运行链：smoke / acceptance / fixture raw response / real parser / real persistence / real export
```

二者缺一不可。

```txt
Inspector 防腐烂。
Smoke 防断链。
Runtime Log 防黑洞。
CI-FULL 统一裁决。
```

#### CI 要求

Deep Research smoke 必须由 `ci:full` 调用。

允许局部命令：

```txt
npm run acceptance:deep-research-analysis-smoke
```

但最终 READY 必须以：

```txt
npm run ci:full
```

为准。

#### 完成标准

Smoke 完成标准只允许：

```txt
PASS
FAIL
```

禁止：

```txt
partial-pass
warning-pass
manual-pass
almost-pass
pass-with-skipped-export
pass-without-runtime-log
pass-without-falsification
```

只要 smoke 失败，Deep Research Analysis 不得声明完成。

---

### [GRASSEYE-DEEP-RESEARCH-014-V1] Report Reader UX 主权

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-014-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast+db+acceptance",
  "summary": "Deep Research APP must present completed jobs as a report history and report reader, not as a raw debug dashboard."
}
```

#### 主权定义

Deep Research APP must present completed jobs as a report history and report reader, not as a raw debug dashboard.

The first screen of a selected completed report must prioritize the final conclusion, confidence, core reasons, strongest opposing arguments, and reverse conditions.

The full 1+N+N+1 flow must be visible in user-readable order:

```txt
decomposition
sub-question positive/falsification pairs
conflict judgment
final synthesis
evidence/debug
```

Raw JSON, hashes, provider proofs, and export paths are debug/evidence metadata and must not dominate the default report reading view.

Long prompt and response content must be collapsed behind More/Show controls by default.

New research creation and completed report reading must be visually separated.

#### 必须

- 历史记录必须来自 persisted jobs，而不是 transient memory。
- selected report reader 必须基于 persisted records 组装，不得要求前端自行拼 raw records。
- decomposition 必须展示为问题树骨架。
- 每个 subQuestion 必须成对展示 positive 与 falsification。
- final synthesis 必须展示在 paired sections 之后。
- evidence/debug 必须默认折叠。

#### 禁止

- latest-only 交付面。
- raw result record 默认占据主阅读区。
- export hash/path 抢占报告正文首屏。
- 把 final report 拆成无主线字段堆。
- new research form 与 completed report reader 混成同一默认主流程。

---

## 4. 二元完成标准

本 Job Flow 只允许二元运行判断：

```txt
PASS
FAIL
```

允许业务记录状态：

```txt
review_required
```

但 job-level `review_required` 不是 PASS。  
sub-question / interaction 级别的 failed 或 review_required 证据，在 minimum material 已满足且 final report 已显式写出 evidence gaps 时，不自动阻止 Job complete。  

禁止：

```txt
partial-pass
warning-pass
pass-with-findings
soft-pass
```

---

## 5. 最小 Acceptance

必须新增：

```txt
scripts/acceptance/deep-research-analysis-smoke.ts
```

Smoke 必须证明：

```txt
1. 用户问题可以创建 ResearchJob。
2. 拆解 prompt 可以生成并发送。
3. 拆解 DOM 回复可以解析成至少 2 个子问题。
4. 子问题可以入库。
5. 单个子问题可以生成 positive prompt。
6. positive 回答可以入库。
7. positive 回答可以生成 falsification prompt。
8. falsification 回答可以入库。
9. final package 只能从数据库记录生成。
10. final report 可以入库。
11. export 可以生成 final-report.md / research-bundle.json / evidence-index.json。
12. 全链路 runtime log 有 started/terminal/failureClass 覆盖。
13. numeric / percentage confidence 会在 parser 中被归一化，而不是直接 kill parse。
14. 单个 sub-question parse 失败不会直接杀死整条研究链；若 minimum material 足够，final report 仍需生成并写出 evidence gaps。
```

---

## 6. 最小 Inspector

必须新增：

```txt
scripts/audit/domains/deep-research-analysis/manifest.json
scripts/audit/domains/deep-research-analysis/inspector.ts
```

Inspector 最少检查：

```txt
1. src/plugins/deep-research-analysis/** 存在 flow/schema/result/index。
2. 本 Job 不包含 planner / nextAction / actionPlan / mission-loop / universal-agent active token。
3. flow 不 import capability private runtime。
4. mediator 不 import 本 Job 内部 step 文件。
5. prompt 字符串不散落在非 prompts 文件。
6. 每个 phase 都有 runtime log event。
7. 每个 AI interaction 都绑定 promptHash / rawResponseHash / parseStatus。
8. final synthesis package 只从 persisted records 构造。
9. export 必须包含 final-report.md / research-bundle.json / evidence-index.json。
10. 同一 subQuestion 的 parse failed 不得伪装成 success；剩余 sub-questions 可以继续，只有 minimum material gate 才能阻断 final path。
11. final synthesis 允许使用系统构造的 conflictMatrix / missingSubQuestionIds 作为 fallback，不得强迫 AI 重复复制系统已知结构。
```

---

## 7. 最终原则

```txt
Deep Research Analysis 的价值不在于让 AI 一次回答得多漂亮。

它的价值在于：
每一次提示词发送都有记录；
每一次 AI 回复都有 DOM 证据；
每一次解析都有结构化结果；
每一次结果都入库；
每一次证伪都绑定正向回答；
最终报告不是凭空生成，而是由完整证据链生成。
```

---

## 8. 唯一人读全流程报告主权

### [GRASSEYE-DEEP-RESEARCH-015-V1] Full Flow Human Report 主权

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-015-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "db+artifact+hash+acceptance+ast",
  "summary": "Deep Research must export exactly one human-readable report, final-report.md, and that report must expose the complete persisted 1+N+N+1 flow with prompt, raw response, parsed summary, and evidence traceability."
}
```

#### 必须

- Deep Research 只允许一个人读报告：`final-report.md`。
- `final-report.md` 必须完整展示 decomposition、每个 sub-question 的 positive / falsification、conflict matrix、final synthesis、以及 evidence index。
- 每个阶段必须展示 prompt、AI raw response、parsed summary、以及 promptHash / rawResponseHash / domRef 等证据字段。
- 报告必须基于 persisted records 构建，而不是只使用运行时临时对象。
- `ResearchInteraction` 必须持久化真正发送给 AI 的 rendered prompt text。
- 缺失、失败、review_required 的阶段必须显式显示，不得静默省略。

#### 允许

- `research-bundle.json` 与 `evidence-index.json` 作为机器证据保留。
- 允许把 markdown 渲染拆成 owner-local support files，但不得形成第二人读报告。

#### 禁止

- 新增 `executive-report.md`、`full-report.md`、`trace-report.md`、`debug-report.md` 等第二人读报告。
- 用 promptHash 代替 prompt 内容。
- 把完整 prompt 或 raw response 只藏在 JSON，不进入 `final-report.md`。
- 把 `final-report.md` 退化回只包含最终摘要的 summary-only 报告。
