# GrassEye Deep Research Analysis Job Flow 施工图

version: 2026-05-23  
status: blueprint  
targetLaw: `GrassEye Deep Research Analysis Job Flow 法案`  
capabilityDomain: `deep-research-analysis`  

---

## 0. 施工目标

本施工图用于实现一个新的 GrassEye Job Flow：

```txt
Deep Research Analysis
```

它的目标不是让 AI 自主思考，也不是构建通用 Agent，而是把一个用户问题变成一套可追溯、可证伪、可导出的研究流水线。

核心链路：

```txt
用户问题
  -> AI 拆解问题
  -> DOM 读取拆解回复
  -> 解析并入库子问题
  -> 逐个发送子问题做正向分析
  -> DOM 读取正向回答
  -> 解析并入库正向回答
  -> 逐个发送证伪请求
  -> DOM 读取证伪回答
  -> 解析并入库证伪回答
  -> 构建最终综合 prompt package
  -> 发送最终报告请求
  -> DOM 读取最终报告
  -> 入库并导出文件
```

一句话：

```txt
发送是动作主线。
记录是价值主线。
DOM 读取是可靠性主线。
数据库是记忆主线。
最终报告是价值体现。
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
       sendPositivePrompt()
       capturePositiveResponse()
       parsePositiveResponse()
       persistPositiveAnswer()
       sendFalsificationPrompt()
       captureFalsificationResponse()
       parseFalsificationResponse()
       persistFalsificationAnswer()
  -> buildConflictMatrix()
  -> buildFinalSynthesisPackage()
  -> sendFinalSynthesisPrompt()
  -> captureFinalReport()
  -> parseFinalReport()
  -> persistFinalReport()
  -> exportResearchBundle()
  -> return result
```

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

---

## 4. 阶段设计

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

### 4.3 POSITIVE ANALYSIS

每个子问题单独发送。

发送内容：

```txt
用户原始问题
+ 当前子问题
+ 正向分析提示词
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
ResearchInteraction phase=positive
ResearchAnswer type=positive
```

---

### 4.4 FALSIFICATION

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

### 4.5 CONFLICT MATRIX

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

### 4.6 FINAL SYNTHESIS

发送内容：

```txt
最终综合提示词
+ 用户原始问题
+ 子问题列表
+ 正向回答摘要
+ 证伪回答摘要
+ 冲突矩阵
+ 输出合同
```

AI 必须输出：

```json
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

必须包含：

```txt
反方观点
证据缺口
反转条件
后续观察信号
limitations
```

缺少任何一项不得 completed。

---

### 4.7 EXPORT

导出文件：

```txt
final-report.md
research-bundle.json
evidence-index.json
```

#### final-report.md

面向用户阅读。

结构：

```md
# Deep Research Final Report

## 1. 原始问题
...

## 2. 最终结论
...

## 3. 置信度
...

## 4. 正方核心理由
...

## 5. 反方核心质疑
...

## 6. 冲突矩阵摘要
...

## 7. 证据缺口
...

## 8. 反转条件
...

## 9. 后续观察信号
...

## 10. 局限性
...
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
  "positiveAnswers": [],
  "falsificationAnswers": [],
  "conflictMatrix": {},
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

Positive、Falsification、Final Synthesis 三类 JSON 输出的 `confidence` 必须是严格枚举：

```txt
"low" | "medium" | "high"
```

禁止：

```txt
0.8
80
"80%"
"high confidence"
```

parser 必须继续拒绝数字 confidence；不得把 `0.8` 自动转换为 `high`。  
prompt 必须明确写入：

```txt
confidence must be exactly one of: "low", "medium", "high".
Do not output numeric confidence.
```

实测基线：旧 positive prompt 曾让 GPT 返回 `"confidence": 0.68` 并在 `POSITIVE_PARSE` 被 parser 拒绝；强化合同后，GPT 在 positive、falsification、final 三类页面实测中均返回 `"confidence": "medium"`。

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
6. parse failed 不得继续进入下一阶段。
7. 每个 interaction 必须记录 promptHash 和 rawResponseHash。
8. final report 必须有 reverseConditions 和 limitations。
9. export 必须生成三件套。
10. runtime log 必须覆盖 stage start/terminal。
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
