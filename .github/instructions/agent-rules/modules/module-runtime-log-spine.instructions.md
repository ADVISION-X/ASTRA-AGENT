---
name: "GrassEye Runtime Log Spine"
description: "Top-level runtime logging law for GrassEye: mission/round/stage/capability/AI/DOM/browser/artifact/recovery observability."
applyTo: "src/lib/runtime-logs/**, src/**/logging.ts, src/plugins/**, src/capabilities/**, src/lib/local-runtime/**, scripts/audit/domains/runtime-log-spine/**, scripts/audit/domains/**/log-coverage/**"
---

# GrassEye Runtime Log Spine 顶级日志法案

status: active  
tier: P0  
capabilityDomain: runtime-log-spine  
enforcementMode: machine-blocking  
evidenceMode: law + blueprint + AST inspection + runtime contract inspection + generated report inspection  
version: 2026-05-22  

---

## 0. 最高定义

Runtime Log Spine 是 GrassEye 的运行神经系统。

它不是 `console.log`，不是调试补丁，不是临时排错工具，不是某个插件自己的私有日志，也不是开发者心情好才加的辅助输出。

它负责让任意一次 human command、mission、run、round、stage、step、capability call、browser action、DOM probe、DOM action、AI request、AI upload、AI response、AI parse、video download、artifact write、navigation、recovery、terminal failure，都可以在事后被完整追踪、还原、定位、裁决和审计。

日志必须做到：

```txt
调试时：放大到电子、原子核级别；
生产时：收缩到流程骨架级别；
审计时：机器可以证明关键路径没有静默黑洞。
```

```apex-law
{
  "lawId": "APEX-RUNTIME-TRUTH-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "runtime-truth",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+runtime-contract",
  "summary": "Any completed runtime contract must require evidence-carrying fields instead of allowing completion with null or missing proof.",
  "clauses": [
    {
      "clauseId": "apex-runtime-truth-001-requirement",
      "statement": "Any completed runtime contract must require evidence-carrying fields instead of allowing completion with null or missing proof.",
      "evidenceMode": "acceptance",
      "ownerDomain": "runtime-truth"
    }
  ]
}
```

## Runtime Completed Evidence Truth

Completed is a proof-bearing terminal state, not a loose UI label.

Required:

- a completed Deep Research result contract must not allow completed output with null final report evidence or empty record-hash proof by default
- runtime-truth inspection must block completed contracts that can represent success without evidence

Forbidden:

- nullable completed evidence fields with null defaults masquerading as lawful completion
- completed status contracts that contain only counters and timestamps but no evidence-bearing field
- declaring completed when the contract still permits missing final raw or missing promoted video proof

日志闭环是稳定闭环的前提。没有日志闭环，就没有自动化稳定性。

---

## 1. 总原则

1. **单一脊柱**：全系统运行日志只能通过 Runtime Log Spine 进入统一结构化事件流。
2. **能放能收**：同一套代码必须支持 `FLOW / DEBUG / TRACE` 三档。
3. **事件即证据**：所有改变流程走向的动作、判断、失败、恢复、跳过、终止，都必须留下结构化事件。
4. **无静默分支**：任何 `if / switch / catch / retry / fallback / skip / terminal / review_required` 分支，只要影响流程走向，必须 emit 日志。
5. **引用优先**：日志不承载大对象本体。大 DOM、大截图、大视频、AI 原始输出、下载文件，必须使用 `refs / hashes / artifactRef`。
6. **安全红线**：TRACE 也不得泄露 cookie、token、password、session、authorization、api key、secret、bearer、localStorage、sessionStorage、完整 signed media URL、长 base64、视频二进制、图片二进制。
7. **机器验收**：日志法案不是倡议，必须由 inspector 阻断式执行。

---

```apex-law
{
  "lawId": "GRASSEYE-RUNTIME-LOG-SPINE-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "runtime-log-spine",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+runtime-contract",
  "summary": "Runtime facts must enter the single Runtime Log Spine instead of console or private log channels.",
  "clauses": [
    {
      "clauseId": "grasseye-runtime-log-spine-001-requirement",
      "statement": "Runtime facts must enter the single Runtime Log Spine instead of console or private log channels.",
      "evidenceMode": "acceptance",
      "ownerDomain": "runtime-log-spine"
    }
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-RUNTIME-LOG-SPINE-002-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "runtime-log-spine",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+runtime-contract",
  "summary": "Every runtime event must declare FLOW, DEBUG, or TRACE visibility and must not leak debug payload into FLOW.",
  "clauses": [
    {
      "clauseId": "grasseye-runtime-log-spine-002-requirement",
      "statement": "Every runtime event must declare FLOW, DEBUG, or TRACE visibility and must not leak debug payload into FLOW.",
      "evidenceMode": "acceptance",
      "ownerDomain": "runtime-log-spine"
    }
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-RUNTIME-LOG-SPINE-003-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "runtime-log-spine",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+runtime-contract",
  "summary": "Mission, run, round, step, capability, AI, and recovery events must carry trace context.",
  "clauses": [
    {
      "clauseId": "grasseye-runtime-log-spine-003-requirement",
      "statement": "Mission, run, round, step, capability, AI, and recovery events must carry trace context.",
      "evidenceMode": "acceptance",
      "ownerDomain": "runtime-log-spine"
    }
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-RUNTIME-LOG-SPINE-004-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "runtime-log-spine",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+runtime-contract",
  "summary": "Any branch that changes execution direction must emit a structured runtime event before it returns, skips, retries, or throws.",
  "clauses": [
    {
      "clauseId": "grasseye-runtime-log-spine-004-requirement",
      "statement": "Any branch that changes execution direction must emit a structured runtime event before it returns, skips, retries, or throws.",
      "evidenceMode": "acceptance",
      "ownerDomain": "runtime-log-spine"
    }
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-RUNTIME-LOG-SPINE-005-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "runtime-log-spine",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+runtime-contract",
  "summary": "Mandatory stages must emit paired started and terminal events with duration, reason, and failure details.",
  "clauses": [
    {
      "clauseId": "grasseye-runtime-log-spine-005-requirement",
      "statement": "Mandatory stages must emit paired started and terminal events with duration, reason, and failure details.",
      "evidenceMode": "acceptance",
      "ownerDomain": "runtime-log-spine"
    }
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-RUNTIME-LOG-SPINE-006-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "runtime-log-spine",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+runtime-contract",
  "summary": "Large artifacts, DOM, AI raw output, and binary content must be referenced by refs and hashes instead of embedded inline.",
  "clauses": [
    {
      "clauseId": "grasseye-runtime-log-spine-006-requirement",
      "statement": "Large artifacts, DOM, AI raw output, and binary content must be referenced by refs and hashes instead of embedded inline.",
      "evidenceMode": "acceptance",
      "ownerDomain": "runtime-log-spine"
    }
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-RUNTIME-LOG-SPINE-007-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "runtime-log-spine",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+runtime-contract",
  "summary": "All runtime sinks must redact secrets, storage data, signed URLs, and base64-like material before output.",
  "clauses": [
    {
      "clauseId": "grasseye-runtime-log-spine-007-requirement",
      "statement": "All runtime sinks must redact secrets, storage data, signed URLs, and base64-like material before output.",
      "evidenceMode": "acceptance",
      "ownerDomain": "runtime-log-spine"
    }
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-RUNTIME-LOG-SPINE-008-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "runtime-log-spine",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+runtime-contract",
  "summary": "Production mode must default to FLOW while DEBUG and TRACE remain explicit opt-in visibility levels.",
  "clauses": [
    {
      "clauseId": "grasseye-runtime-log-spine-008-requirement",
      "statement": "Production mode must default to FLOW while DEBUG and TRACE remain explicit opt-in visibility levels.",
      "evidenceMode": "acceptance",
      "ownerDomain": "runtime-log-spine"
    }
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-RUNTIME-LOG-SPINE-009-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "runtime-log-spine",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+runtime-contract",
  "summary": "DEBUG and TRACE logging must preserve enough evidence to explain one round down to single actions and retries.",
  "clauses": [
    {
      "clauseId": "grasseye-runtime-log-spine-009-requirement",
      "statement": "DEBUG and TRACE logging must preserve enough evidence to explain one round down to single actions and retries.",
      "evidenceMode": "acceptance",
      "ownerDomain": "runtime-log-spine"
    }
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-RUNTIME-LOG-SPINE-010-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "runtime-log-spine",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+runtime-contract",
  "summary": "Failed, skipped, and review-required events must carry classified failure metadata instead of free text alone.",
  "clauses": [
    {
      "clauseId": "grasseye-runtime-log-spine-010-requirement",
      "statement": "Failed, skipped, and review-required events must carry classified failure metadata instead of free text alone.",
      "evidenceMode": "acceptance",
      "ownerDomain": "runtime-log-spine"
    }
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-RUNTIME-LOG-SPINE-011-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "runtime-log-spine",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+runtime-contract",
  "summary": "All key terminal stage events must record duration and configured timeout evidence where applicable.",
  "clauses": [
    {
      "clauseId": "grasseye-runtime-log-spine-011-requirement",
      "statement": "All key terminal stage events must record duration and configured timeout evidence where applicable.",
      "evidenceMode": "acceptance",
      "ownerDomain": "runtime-log-spine"
    }
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-RUNTIME-LOG-SPINE-012-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "runtime-log-spine",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+runtime-contract",
  "summary": "Each mission must produce a replayable debug bundle or emit structured bundle-write failure evidence.",
  "clauses": [
    {
      "clauseId": "grasseye-runtime-log-spine-012-requirement",
      "statement": "Each mission must produce a replayable debug bundle or emit structured bundle-write failure evidence.",
      "evidenceMode": "acceptance",
      "ownerDomain": "runtime-log-spine"
    }
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-RUNTIME-LOG-SPINE-013-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "runtime-log-spine",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+runtime-contract",
  "summary": "AI request, upload, response, parse, and validation paths must emit provider proof, refs, hashes, and statuses.",
  "clauses": [
    {
      "clauseId": "grasseye-runtime-log-spine-013-requirement",
      "statement": "AI request, upload, response, parse, and validation paths must emit provider proof, refs, hashes, and statuses.",
      "evidenceMode": "acceptance",
      "ownerDomain": "runtime-log-spine"
    }
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-RUNTIME-LOG-SPINE-014-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "runtime-log-spine",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+runtime-contract",
  "summary": "Browser and DOM actions must log before state, attempted action, after state, duration, and failure class.",
  "clauses": [
    {
      "clauseId": "grasseye-runtime-log-spine-014-requirement",
      "statement": "Browser and DOM actions must log before state, attempted action, after state, duration, and failure class.",
      "evidenceMode": "acceptance",
      "ownerDomain": "runtime-log-spine"
    }
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-RUNTIME-LOG-SPINE-015-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "runtime-log-spine",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+runtime-contract",
  "summary": "Every recovery and fallback path must emit a linked recovery trail tied to the originating failure.",
  "clauses": [
    {
      "clauseId": "grasseye-runtime-log-spine-015-requirement",
      "statement": "Every recovery and fallback path must emit a linked recovery trail tied to the originating failure.",
      "evidenceMode": "acceptance",
      "ownerDomain": "runtime-log-spine"
    }
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-RUNTIME-LOG-SPINE-016-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "runtime-log-spine",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+runtime-contract",
  "summary": "Each plugin and capability must maintain a machine-enforced logging matrix for mandatory stages and contracts.",
  "clauses": [
    {
      "clauseId": "grasseye-runtime-log-spine-016-requirement",
      "statement": "Each plugin and capability must maintain a machine-enforced logging matrix for mandatory stages and contracts.",
      "evidenceMode": "acceptance",
      "ownerDomain": "runtime-log-spine"
    }
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-RUNTIME-LOG-SPINE-017-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "runtime-log-spine",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+runtime-contract",
  "summary": "All runtime event types must come from the central event registry instead of free string literals.",
  "clauses": [
    {
      "clauseId": "grasseye-runtime-log-spine-017-requirement",
      "statement": "All runtime event types must come from the central event registry instead of free string literals.",
      "evidenceMode": "acceptance",
      "ownerDomain": "runtime-log-spine"
    }
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-RUNTIME-LOG-SPINE-018-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "runtime-log-spine",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+runtime-contract",
  "summary": "CI must emit machine-readable and human-readable runtime log coverage reports with mandatory stage and failure coverage.",
  "clauses": [
    {
      "clauseId": "grasseye-runtime-log-spine-018-requirement",
      "statement": "CI must emit machine-readable and human-readable runtime log coverage reports with mandatory stage and failure coverage.",
      "evidenceMode": "acceptance",
      "ownerDomain": "runtime-log-spine"
    }
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-RUNTIME-LOG-SPINE-019-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "runtime-log-spine",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+runtime-contract",
  "summary": "Any failed or review-required round must be diagnosable from runtime logs without rerunning the mission.",
  "clauses": [
    {
      "clauseId": "grasseye-runtime-log-spine-019-requirement",
      "statement": "Any failed or review-required round must be diagnosable from runtime logs without rerunning the mission.",
      "evidenceMode": "acceptance",
      "ownerDomain": "runtime-log-spine"
    }
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-RUNTIME-LOG-SPINE-020-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "runtime-log-spine",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+runtime-contract",
  "summary": "Automation, AI, DOM, browser, artifact, navigation, and recovery changes must satisfy log law before merge.",
  "clauses": [
    {
      "clauseId": "grasseye-runtime-log-spine-020-requirement",
      "statement": "Automation, AI, DOM, browser, artifact, navigation, and recovery changes must satisfy log law before merge.",
      "evidenceMode": "acceptance",
      "ownerDomain": "runtime-log-spine"
    }
  ]
}
```

---

# Law GRASSEYE-RUNTIME-LOG-SPINE-001-V1

## 主题：单一日志脊柱主权

全系统运行日志必须通过 `RuntimeLogger.emit` 或 Runtime Log Spine 授权的 event factory / stage logger 进入统一结构化事件流。

允许存在 terminal sink、JSONL file sink、debug bundle sink、test sink、future UI live sink，但所有 sink 只能消费 Runtime Log Spine 事件，不得绕过 Runtime Log Spine 成为事实生产者。

### 必须

- 所有运行事实事件必须符合 `RuntimeLogEvent` 合同。
- 所有插件、能力组、runtime、AI provider、browser adapter 必须通过注入的 `RuntimeLogger` 或授权 logger wrapper 发事件。
- 所有关键失败必须有结构化日志。
- 所有关键阶段必须有阶段日志。

### 禁止

FORBIDDEN:

- `console.log` 作为运行事实来源；
- `console.error` 作为失败事实来源；
- `process.stdout.write` 作为业务运行事实来源；
- 插件私有 logger 替代 Runtime Log Spine；
- 插件私有 JSONL 运行日志替代 Runtime Log Spine；
- `throw new Error()` 前没有结构化失败事件；
- `catch {}` 静默吞错；
- AI / DOM / browser action 只靠 return value 不打日志。

### 验收

Inspector 必须阻断：

- `src/**` 中出现未授权 `console.log / console.error / console.warn / console.debug`；
- 运行模块直接写日志文件但未经过 Runtime Log Spine；
- 关键插件没有注入 `RuntimeLogger`；
- catch 分支没有 Runtime Log emit；
- mission / round / step 没有日志事件。

---

# Law GRASSEYE-RUNTIME-LOG-SPINE-002-V1

## 主题：三档可见性

所有 Runtime Log Event 必须声明 `modeVisibility`。

只允许三档：

```txt
FLOW  = 生产流程视图
DEBUG = 调试阶段视图
TRACE = 深度验尸视图
```

### FLOW

只显示 mission lifecycle、round lifecycle、major decision、saved count、scanned count、failure summary、terminal status。

FLOW 不得显示 raw DOM、selector candidates、full prompts、raw AI response、full comments、full URLs with sensitive query、file binary、base64、browser internal state。

### DEBUG

显示 stage started/completed/failed、input/output 摘要、counters、durations、artifact refs、hashes、clipped previews、failure class、recovery trail 摘要。

### TRACE

显示 DOM selector candidates、DOM probe normalized facts、browser action attempts、click target facts、upload strategy、AI prompt package refs/hashes、AI raw response refs/hashes、parse details、retry timeline、fallback decision tree、before/after signatures、video identity evidence chain。

TRACE 仍不得显示安全红线材料。

### 禁止

FORBIDDEN:

- 事件无 `modeVisibility`；
- 调试事件只设 `FLOW`；
- 生产 FLOW 输出 TRACE payload；
- TRACE 绕过 redaction；
- 通过私有变量制造第四档模式。

---

# Law GRASSEYE-RUNTIME-LOG-SPINE-003-V1

## 主题：Trace / Span 全链路追踪

每次 mission 必须形成完整 trace tree。

推荐映射：

```txt
traceId         = runId
mission span    = missionId
round span      = roundId
step span       = stepId
capability span = capabilityCallId
```

关键事件必须携带 `traceId / owner / eventType / modeVisibility`。mission-bound 事件必须有 `missionId`；run-bound 事件必须有 `runId`；round-bound 事件必须有 `roundId`；step-bound 事件必须有 `stepId`；capability-bound 事件必须有 `capabilityCallId`。

### 禁止

FORBIDDEN:

- mission 事件无 `traceId`；
- round 事件无 `roundId`；
- step 事件无 `stepId`；
- capability dispatch 无 `capabilityCallId`；
- AI request / response 无同一 trace；
- recovery action 与 failure event 无关联。

---

# Law GRASSEYE-RUNTIME-LOG-SPINE-004-V1

## 主题：无静默分支

任何影响流程走向的分支必须留下结构化日志。

影响流程走向包括：start、complete、fail、review_required、skip、retry、fallback、recover、terminal、continue、duplicate、not interested、next video、save、reject、delete artifact、promote artifact、parse invalid、schema invalid、timeout、blocked、tab drift、page drift、navigation unchanged。

### 必须

以下结构必须有日志：

- `catch`
- `if (!ok)`
- `if (status !== "success")`
- `if (terminal)`
- `if (reviewRequired)`
- `if (timeout)`
- `if (duplicate)`
- `return { terminal: true }`
- `return { status: "failed" }`
- `return { status: "review_required" }`
- fallback branch
- retry exhaustion branch

### 禁止

FORBIDDEN:

- 空 catch；
- catch 只 return 不 emit；
- fallback 执行无日志；
- retry 失败无日志；
- review_required 无 reason；
- terminal 无 reason；
- skip 无 reason；
- parse failed 无 raw output ref/hash；
- navigation failed 无 before/after evidence。

---

# Law GRASSEYE-RUNTIME-LOG-SPINE-005-V1

## 主题：阶段开始 / 结束成对

所有关键阶段必须有：

```txt
STAGE_STARTED
STAGE_COMPLETED | STAGE_FAILED | STAGE_SKIPPED | STAGE_REVIEW_REQUIRED
```

成对事件。

阶段事件必须包含：`stageName / stageAttempt / status / durationMs / inputHash / outputHash 或 outputRef / failureClass / reason / recoveryTrail`。

### 禁止

FORBIDDEN:

- 只有 completed 没有 started；
- 只有 started 没有 terminal event；
- failed 无 duration；
- failed 无 reason；
- skipped 无 reason；
- retry 无 attempt index；
- stage name 使用自由字符串无枚举。

---

# Law GRASSEYE-RUNTIME-LOG-SPINE-006-V1

## 主题：证据引用优先

日志事件不得承载大对象本体。大对象必须写入 artifact/debug bundle/forensics，再通过 refs/hashes 引用。

大对象包括：full DOM text、full HTML、screenshot base64、image binary、video binary、AI raw response、AI prompt、comments full collection、browser full storage state、media URL with signed query、HAR/network dump、downloaded file。

### 禁止

FORBIDDEN:

- payload 中放完整 HTML；
- payload 中放完整 bodyText；
- payload 中放完整 AI response；
- payload 中放 base64；
- payload 中放视频二进制；
- payload 中放完整 signed URL；
- preview 超过固定上限；
- artifact ref 无 hash。

---

# Law GRASSEYE-RUNTIME-LOG-SPINE-007-V1

## 主题：红线脱敏

任何 sink 输出前必须经过 redaction。TRACE 模式不得绕过安全红线。

必须脱敏：cookie、cookies、token、authorization、password、api_key、api-key、secret、session、bearer、auth、localStorage、sessionStorage、browser password、signed media URL query、long base64-like string、`data:*;base64,`。

### 必须保留调试价值

脱敏后仍必须保留：redacted URL origin + pathname、hash、byte size、content type、duration、selected strategy、status code、failure class、reason、artifact ref。

### 禁止

FORBIDDEN:

- `redact: false` 用于生产；
- TRACE 写入 secret；
- terminal 打印 secret；
- file sink 明文 secret；
- full signed URL 写入 durable log。

---

# Law GRASSEYE-RUNTIME-LOG-SPINE-008-V1

## 主题：生产收缩

生产默认 `FLOW`。`DEBUG / TRACE` 必须通过显式配置开启。

FLOW 只显示任务流程、状态、数量、耗时摘要和终止原因。

### 禁止

FORBIDDEN:

- 默认 TRACE；
- 生产环境无显式开关进入 TRACE；
- FLOW 输出 TRACE payload；
- 为减少日志删除 DEBUG/TRACE 代码；
- 生产使用 console 临时代替 flow log。

---

# Law GRASSEYE-RUNTIME-LOG-SPINE-009-V1

## 主题：调试放大

DEBUG / TRACE 模式必须让开发者完整解释任一 round 的运行过程。

TRACE 模式必须能定位到：单个 selector 候选、单次 click、单次 scroll、单次 key press、单次 AI upload attempt、单次 AI parse failure、单次 video download candidate validation、单次 navigation fallback、单次 recovery action。

TRACE 事件必须能回答：

```txt
系统当时看到了什么？
系统为什么选择这个动作？
系统尝试了什么？
系统得到了什么反馈？
系统为什么继续 / 重试 / 跳过 / 停止？
```

---

# Law GRASSEYE-RUNTIME-LOG-SPINE-010-V1

## 主题：错误分类

所有 failed / review_required / skipped / retry_exhausted 事件必须携带 `failureClass`。禁止只有自由文本 `reason`。

标准 FailureClass：

```txt
TRANSIENT_RETRYABLE
SKIPPABLE_ROUND_FAILURE
RECOVERABLE_BROWSER_DRIFT
ACCOUNT_SECURITY_BLOCKER
PLATFORM_RATE_LIMIT
SCHEMA_CONTRACT_VIOLATION
AI_PROVIDER_FAILURE
AI_PARSE_FAILURE
MEDIA_DOWNLOAD_FAILURE
DOM_PROBE_FAILURE
NAVIGATION_FAILURE
ARTIFACT_FAILURE
INTERNAL_BUG
UNKNOWN
```

失败事件必须包含 `failureClass / reason / stageName / recoveryPolicy / retryable / terminal / actionableMessage`。

---

# Law GRASSEYE-RUNTIME-LOG-SPINE-011-V1

## 主题：耗时与性能

所有关键阶段 terminal event 必须记录 `durationMs`。

必须记录耗时：mission total、round total、open feed、wait video stable、DOM probe、comment collection、video download、AI upload、AI generation wait、AI parse、save/promote、delete rejected artifact、not interested、navigation、recovery action、retry wait。

### 禁止

FORBIDDEN:

- completed 无 durationMs；
- failed 无 durationMs；
- retry 无 attempt duration；
- timeout 无 configured timeoutMs。

---

# Law GRASSEYE-RUNTIME-LOG-SPINE-012-V1

## 主题：可回放 Debug Bundle

每次 mission 必须生成可回放 debug bundle。

最小结构：

```txt
runtime-log.jsonl
mission-summary.json
config.redacted.json
rounds/
  round-000001/
    round-summary.json
    dom-probe.json
    comments.summary.json
    video-download-result.json
    ai-request.summary.json
    ai-response.raw.ref.json
    ai-parse-result.json
    navigation-before.json
    navigation-after.json
    recovery-trail.json
artifacts/
  refs.json
```

Bundle 写入失败不得 crash mission，但必须发 `DEBUG_BUNDLE_WRITE_FAILED` 事件。

---

# Law GRASSEYE-RUNTIME-LOG-SPINE-013-V1

## 主题：AI 请求与响应可观测性

任何 AI 调用必须完整记录请求、上传、响应、解析、校验、失败恢复链路。

AI request started 必须记录：providerKind、modelName、promptPackageRef、promptHash、inputRefs、expectedOutputSchemaRef、fileRefs、fileHashes、timeoutMs。

AI upload trace 必须记录：uploadStrategy、filePath hash、fileByteSize、fileMimeType、composerDetected、fileChipDetected、submitEnabled、uploadWaitMs。

AI response completed 必须记录：rawOutputRef、rawOutputHash、outputPreview clipped、providerProof、durationMs。

AI parse 必须记录：parseStatus、schemaValidationStatus、normalizedOutputHash、parseErrorClass、parseErrorMessage clipped。

---

# Law GRASSEYE-RUNTIME-LOG-SPINE-014-V1

## 主题：Browser / DOM Action 可观测性

所有浏览器动作和 DOM 动作必须可追踪、可复核、可解释。

每个 browser/DOM action 必须记录：target description、action kind、selector or grid evidence ref、before signature/hash、action attempt index、action result、after signature/hash、durationMs、fallback used、failureClass if failed。

### 禁止

FORBIDDEN:

- click 后不验证；
- scroll 后不验证；
- key press 后不验证；
- DOM selector 只有最终选择，没有候选；
- action failed 只返回 false；
- navigation changed 只靠 URL；
- next video 成功只靠点击成功。

---

# Law GRASSEYE-RUNTIME-LOG-SPINE-015-V1

## 主题：恢复链路

任何 recovery 必须留下 recovery trail。

Recovery event 必须包含：originalFailureEventId、failureClass、recoveryPolicy、recoveryAttemptIndex、recoveryAction、beforeStateHash、afterStateHash、recoveryStatus、terminalAfterRecovery、nextPlannedStage。

### 禁止

FORBIDDEN:

- 自动恢复无日志；
- fallback 无日志；
- recovery 成功但不关联原始失败；
- recovery 失败但 reason 丢失；
- recovery 后继续流程但无 nextPlannedStage。

---

# Law GRASSEYE-RUNTIME-LOG-SPINE-016-V1

## 主题：领域日志矩阵

每个业务插件和能力组必须拥有日志矩阵。

日志矩阵必须定义：stageName、FLOW visibility、DEBUG visibility、TRACE visibility、required fields、required refs、required hashes、failure classes、recovery policy、inspector coverage。

### 禁止

FORBIDDEN:

- 插件无日志矩阵；
- 插件只打 flow log；
- 插件失败路径无 matrix；
- 插件新增 stage 不更新 matrix；
- matrix 与代码事件不一致。

---

# Law GRASSEYE-RUNTIME-LOG-SPINE-017-V1

## 主题：事件类型登记

所有 eventType 必须来自中央事件类型登记。禁止自由字符串 eventType。

### 禁止

FORBIDDEN:

- `eventType: "xxx"` 手写字符串；
- plugin 自造未登记事件；
- 同义事件重复存在；
- eventType 无 owner；
- eventType 与实际 stage 不符。

---

# Law GRASSEYE-RUNTIME-LOG-SPINE-018-V1

## 主题：日志覆盖率报告

CI 必须生成 Runtime Log Coverage Report。

报告必须说明：每个 domain 的 mandatory stages、每个 mandatory stage 的 started/terminal coverage、每个 failure branch 的 log coverage、每个 recovery branch 的 log coverage、每个 AI call 的 request/response/parse coverage、每个 browser action 的 before/action/after coverage、redaction inspection result、console forbidden surface result、bundle generation acceptance result。

---

# Law GRASSEYE-RUNTIME-LOG-SPINE-019-V1

## 主题：一眼诊断

任意 failed / review_required round 必须能通过日志自动生成一份人类可读诊断。

诊断必须回答：

```txt
1. 哪个 mission / run / round 失败？
2. 失败在哪个 stage？
3. failureClass 是什么？
4. 当时系统看到什么？
5. 尝试过哪些动作？
6. 尝试过哪些恢复？
7. 最终为什么跳过 / 停止？
8. 下一步建议是什么？
```

---

# Law GRASSEYE-RUNTIME-LOG-SPINE-020-V1

## 主题：日志发布门禁

任何涉及自动化流程、AI 调用、DOM 操作、browser action、artifact 写入、navigation、recovery 的代码变更，如果没有同步满足日志法案，不得进入生产。

FORBIDDEN:

- 功能先合并，日志以后补；
- 调试靠临时 console；
- 生产 bug 出现后再补日志；
- acceptance 不验证日志；
- inspector 不覆盖日志。

---

## 附录 A：标准 RuntimeLogEvent 最低字段

```ts
type MinimumRuntimeLogEvent = {
  traceId: string;
  level: "debug" | "info" | "warn" | "error";
  modeVisibility: Array<"FLOW" | "DEBUG" | "TRACE">;
  eventType: RuntimeLogEventType;
  owner: RuntimeLogOwner;
  status?: "started" | "success" | "failed" | "review_required" | "skipped";
  reason?: string;
  createdAt: string;
};
```

关键事件扩展：

```ts
type CriticalRuntimeLogEvent = MinimumRuntimeLogEvent & {
  missionId: string;
  runId: string;
  roundId?: string;
  stepId?: string;
  spanId?: string;
  parentSpanId?: string;
  durationMs?: number;
  refs?: Record<string, string>;
  metrics?: Record<string, number>;
  hashes?: Record<string, string>;
  preview?: Record<string, string>;
  payload?: Record<string, unknown>;
};
```

失败事件扩展：

```ts
type FailureRuntimeLogEvent = CriticalRuntimeLogEvent & {
  status: "failed" | "review_required" | "skipped";
  reason: string;
  payload: {
    failureClass: RuntimeFailureClass;
    stageName: string;
    retryable: boolean;
    terminal: boolean;
    recoveryPolicy: string;
    recoveryTrail?: unknown[];
  };
};
```

---

## 附录 B：完成硬标准

```txt
1. FLOW 模式能让使用者看到任务是否正常跑。
2. DEBUG 模式能让开发者知道每一阶段成功还是失败。
3. TRACE 模式能让开发者定位失败到单个动作、单个候选、单次上传、单次解析、单次恢复。
4. 任意 failed round 可自动生成诊断报告。
5. CI 能证明关键路径没有日志黑洞。
6. secret 永不进入日志 sink。
7. 新增自动化功能没有日志矩阵不得合并。
```
