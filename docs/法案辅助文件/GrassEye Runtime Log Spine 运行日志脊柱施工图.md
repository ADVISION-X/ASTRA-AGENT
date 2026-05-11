# GrassEye Runtime Log Spine Final Blueprint

版本: FINAL  
状态: active  
对应法案: `.github/instructions/cursor-rules/modules/module-structured-logging.instructions.md`  
施工主旨: 调试时看头发丝，成功后只看流程。

---

## 1. 最终定位

Runtime Log Spine 是 GrassEye 的第二基础质检。

它不是能力组。  
它不是 Forensics。  
它不是 event bus。  
它不是 dashboard。  
它不是 metrics system。  

它只是：

```txt
全系统统一结构化事件出口。
```

一句话：

```txt
日志脊柱 = 防止系统失明。
```

---

## 2. 为什么必须存在

放弃细节质检后，系统必须有强观测能力。

如果没有日志：

```txt
错误不知道发生在哪一层；
AI 吃了什么不知道；
AI 吐了什么不知道；
调度发给谁不知道；
能力输入输出不知道；
失败 owner 不知道；
调试会变成无底洞。
```

Runtime Log Spine 的目标是：

```txt
任何失败，5 分钟内定位到 owner 和输入输出。
```

---

## 3. 三档模式

### 3.1 FLOW

默认模式。

```txt
GRASSEYE_LOG_MODE unset
```

显示：

```txt
MISSION_STARTED
ROUND_STARTED
SCREENSHOT_CAPTURED
AI_DECISION_SUMMARY
CAPABILITY_DISPATCH_STARTED
CAPABILITY_DISPATCH_COMPLETED
CAPABILITY_DISPATCH_FAILED
MISSION_COMPLETED
MISSION_REVIEW_REQUIRED
MISSION_STOPPED
```

特点：

```txt
安静、短、可读。
```

---

### 3.2 DEBUG

```txt
GRASSEYE_LOG_MODE=DEBUG
```

额外显示：

```txt
HUMAN_COMMAND_RECEIVED
COORDINATE_GRID_RENDERED
AI_REQUEST_DEBUG
AI_RAW_RESPONSE_DEBUG
AI_PARSE_RESULT_DEBUG
AI_ERROR_DEBUG
GEOMETRY_GUARD_RESULT
BROWSER_ACTION_RESULT
TEXT_INPUT_RESULT
OPEN_RESULT
FORENSICS_RECORD_APPENDED
```

特点：

```txt
显示 refs/hash/preview/owner，不刷巨大 payload。
```

---

### 3.3 TRACE

```txt
GRASSEYE_LOG_MODE=TRACE
```

额外显示：

```txt
full prompt ref/hash
full raw response ref/hash
schema validation detail
duration breakdown
all owner boundaries
all input/output refs
```

特点：

```txt
头发丝级，但必须可开可关。
```

---

## 4. 代码结构

必须保持：

```txt
src/lib/runtime-logs/
  index.ts
  schema.ts
  event-types.ts
  mode.ts
  redaction.ts
  trace.ts
  sinks.ts
  logger.ts
```

文件上限：

```txt
src/lib/runtime-logs <= 8 files
```

职责：

| 文件 | 职责 |
|---|---|
| index.ts | public exports |
| schema.ts | RuntimeLogEvent / RuntimeLogger types |
| event-types.ts | canonical eventType / owner |
| mode.ts | FLOW/DEBUG/TRACE 解析 |
| redaction.ts | redactRuntimeLogPayload |
| trace.ts | traceId/spanId 工具 |
| sinks.ts | terminal + file bundle sink |
| logger.ts | createRuntimeLogger / emit |

---

## 5. RuntimeLogEvent

必须字段：

```txt
eventId
traceId
level
modeVisibility
eventType
owner
createdAt
```

上下文字段：

```txt
missionId
runId
sessionId
roundId
stepId
capabilityCallId
nerveBusEnvelopeId
platformId
abilityGroupId
childCapabilityId
```

诊断字段：

```txt
status
reason
actionableMessage
ownerResponsible
refs
metrics
hashes
preview
payload
durationMs
```

---

## 6. AI 四件套

AI 调用必须按顺序：

```txt
AI_REQUEST_DEBUG
AI_RAW_RESPONSE_DEBUG
AI_PARSE_RESULT_DEBUG
AI_ERROR_DEBUG
```

### 6.1 AI_REQUEST_DEBUG

时机：

```txt
callLocalModel 之前
```

必须有：

```txt
promptHash
promptPreview
modelName
runtimeName
imageRefs/imageHashes
traceId/spanId
missionId/roundId/stepId if available
```

### 6.2 AI_RAW_RESPONSE_DEBUG

时机：

```txt
模型返回后，解析前
```

必须有：

```txt
rawResponseHash
rawResponsePreview
durationMs
status
```

### 6.3 AI_PARSE_RESULT_DEBUG

时机：

```txt
JSON/schema 解析后
```

必须有：

```txt
schemaStatus
parserErrors
actionCount
schemaIssueCount
```

### 6.4 AI_ERROR_DEBUG

时机：

```txt
AI failure 逃出前
```

必须有：

```txt
errorKind
failureReason
ownerResponsible
actionableMessage
```

---

## 7. Terminal / File / Forensics

### 7.1 Terminal

只负责实时显示。

禁止：

```txt
terminal output as truth
full raw prompt in FLOW/DEBUG terminal
full raw response in FLOW/DEBUG terminal
secret/base64 in terminal
```

### 7.2 File Debug Bundle

路径：

```txt
data/runtime-logs/<missionId>/<runId>.jsonl
tmp/runtime-logs/<runId>.jsonl
```

要求：

```txt
JSONL
redacted
traceId 可回放
DEBUG/TRACE 更完整
```

### 7.3 Forensics

Runtime Log Spine 不直接写 Forensics private runtime。

如需长期证据：

```txt
Orchestration or caller -> forensics-persistence.append-record(recordType="runtime_log")
```

---

## 8. Redaction

统一函数：

```txt
redactRuntimeLogPayload()
```

必须处理：

```txt
cookies
tokens
authorization
password
apiKey
session
base64 image
private secret
```

输出：

```txt
[REDACTED]
hash
size
dimensions
artifactRef
basename
```

---

## 9. 模块接入点

### 9.1 Local AI

文件：

```txt
src/lib/local-ai/call-local-model.ts
```

必须：

```txt
接受 runtimeLogger / traceContext
调用模型前 AI_REQUEST_DEBUG
模型返回后 AI_RAW_RESPONSE_DEBUG
失败前 AI_ERROR_DEBUG
```

### 9.2 AI Capability

文件：

```txt
src/capabilities/ai/runtime/model-call.ts
src/capabilities/ai/children/visual-mission-judge-once.ts
```

必须：

```txt
parse 后 AI_PARSE_RESULT_DEBUG
failure 前 AI_ERROR_DEBUG
```

### 9.3 Orchestration

必须发 FLOW：

```txt
MISSION_STARTED
ROUND_STARTED
CAPABILITY_DISPATCH_STARTED
CAPABILITY_DISPATCH_COMPLETED
CAPABILITY_DISPATCH_FAILED
MISSION_REVIEW_REQUIRED
MISSION_COMPLETED
MISSION_STOPPED
```

### 9.4 Capability Groups

入口至少发：

```txt
CAPABILITY_DISPATCH_STARTED
CAPABILITY_DISPATCH_COMPLETED / FAILED
```

能力组不得自己创建全局 logger。  
由上层注入。

---

## 10. Runtime Logging Inspector

路径：

```txt
scripts/audit/domains/runtime-logging/
  config.ts
  inspector.ts
  run-inspector.ts
```

上限：

```txt
<= 3 files
each <= 250 lines
```

检查：

```txt
module-structured-logging active
src/lib/runtime-logs <= 8 files
RuntimeLogEvent fields
FLOW/DEBUG/TRACE
redaction
console scatter
AI four-piece events
logger no private runtime import
LocalAiDebugHook retired
```

---

## 11. 验收命令

### 文件数

```bash
git ls-files 'src/lib/runtime-logs/**/*.{ts,tsx,js,jsx,json}' | wc -l
git ls-files 'scripts/audit/domains/runtime-logging/**/*.{ts,tsx,js,jsx,json}' | wc -l
```

目标：

```txt
runtime-logs <= 8
runtime-logging audit <= 3
```

### AI 四件套

```bash
rg -n "AI_REQUEST_DEBUG|AI_RAW_RESPONSE_DEBUG|AI_PARSE_RESULT_DEBUG|AI_ERROR_DEBUG" src/capabilities/ai src/lib/local-ai src/lib/runtime-logs
```

必须四种都有。

### 禁止 console scatter

```bash
rg -n "console\.log|console\.error|console\.warn|console\.debug" src
```

只允许：

```txt
src/lib/runtime-logs/sinks.ts
CLI entrypoint
```

### 不越权

```bash
rg -n "forensics-persistence/runtime|orchestration/runtime|BrowserController|callLocalModel\(" src/lib/runtime-logs
```

期望无命中。

### LocalAiDebugHook 退役

```bash
rg -n "LocalAiDebugHook|debugHook|detail: string" src/lib/local-ai src/capabilities/ai
```

期望无主线命中。

---

## 12. CI 接入

Runtime Log Spine 必须作为 CI-FULL 三件套之一：

```txt
typecheck
code-purity
runtime-log-spine
```

日志质检失败，CI-FULL 失败。

---

## 13. Final Acceptance

PASS 意味着：

```txt
系统不会失明；
AI 输入输出可查；
能力边界输入输出可查；
错误 owner 可查；
生产默认安静；
调试可一键加深。
```

不意味着：

```txt
业务一定正确；
AI 一定判断正确；
平台动作一定成功。
```

---

## 14. Final Sentence

```txt
Runtime Log Spine 不让系统正确；
它让系统错误时无处可藏。
```
