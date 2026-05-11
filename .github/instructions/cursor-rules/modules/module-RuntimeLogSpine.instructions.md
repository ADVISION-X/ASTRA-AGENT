---
name: "GrassEye Runtime Log Spine Final"
description: "Final law for runtime logging, FLOW/DEBUG/TRACE visibility, AI I/O transparency, redaction, terminal/file separation, and anti-blind debugging."
applyTo: ".github/instructions/cursor-rules/modules/module-structured-logging.instructions.md, src/lib/runtime-logs/**, src/capabilities/ai/**, src/lib/local-ai/**, scripts/audit/domains/runtime-logging/**"
status: "final"
---

# GrassEye Runtime Log Spine Final Law

版本: FINAL  
状态: active  
主权: final-runtime-log-spine-law  
替换: all previous structured logging, runtime debug transparency, scattered debug hook, console debug, and detailed action log laws that conflict with this file.

---

## 0. Final Doctrine

GrassEye 调试不能盲飞。

Runtime Log Spine 的最终价值：

```txt
调试时看见头发丝；
成功后只看流程；
错误发生时立刻知道谁吃了什么、吐了什么、谁负责。
```

日志不是业务系统。  
日志不是能力组。  
日志不是 Forensics。  
日志不是 event bus。  
日志不是 dashboard。  
日志不是 metrics system。  

日志只是一根透明神经。

---

## 1. Scope

本法案治理：

```txt
RuntimeLogEvent
FLOW / DEBUG / TRACE
traceId / spanId
AI_REQUEST_DEBUG
AI_RAW_RESPONSE_DEBUG
AI_PARSE_RESULT_DEBUG
AI_ERROR_DEBUG
redaction
terminal sink
file debug bundle
console scatter ban
runtime log inspector
```

本法案不治理：

```txt
业务判断
AI 判断正确性
能力调度
浏览器动作
Forensics 长期存储
UI dashboard
metrics aggregation
```

---

## 2. Highest Rules

### LAW-RLS-001: Runtime Log Spine Is Not An Owner

status: active  
tier: P0  
enforcementMode: machine-blocking

```txt
Runtime Log Spine is a neutral observation spine.
It must not become an owner.
```

必须：

```txt
通过依赖注入提供 runtimeLogger。
不直接 import 能力组 private runtime。
不调用 browser controller。
不调用 Forensics private storage。
不维护 mission state。
不做业务判断。
```

禁止：

```txt
logger 成为 capability group。
logger 成为 persistence owner。
logger 成为 event bus。
logger 成为 dashboard。
logger import forensics-persistence/runtime。
logger import orchestration/runtime。
logger import BrowserController。
```

---

### LAW-RLS-002: FLOW / DEBUG / TRACE Are Mandatory

status: active  
tier: P0  
enforcementMode: machine-blocking

必须有三档：

```txt
FLOW  = 默认生产流程骨架
DEBUG = 日常调试关键输入输出
TRACE = 头发丝级排查
```

默认：

```txt
GRASSEYE_LOG_MODE unset => FLOW
GRASSEYE_LOG_MODE=DEBUG => DEBUG
GRASSEYE_LOG_MODE=TRACE => TRACE
```

每条事件必须声明：

```txt
modeVisibility: Array<"FLOW" | "DEBUG" | "TRACE">
```

禁止：

```txt
默认 DEBUG
默认 TRACE
写死日志模式
事件无 modeVisibility
通过改代码切换模式
```

---

### LAW-RLS-003: RuntimeLogEvent Shape Is Fixed

status: active  
tier: P0  
enforcementMode: machine-blocking

每条 RuntimeLogEvent 必须包含：

```txt
eventId
traceId
level
modeVisibility
eventType
owner
createdAt
```

建议包含：

```txt
spanId
parentSpanId
ownerResponsible
missionId
runId
roundId
stepId
capabilityCallId
nerveBusEnvelopeId
abilityGroupId
childCapabilityId
status
reason
actionableMessage
refs
metrics
hashes
preview
payload
durationMs
```

禁止：

```txt
detail-only debug event
free-text log as proof
event without traceId
event without owner
eventType outside canonical enum
```

---

### LAW-RLS-004: AI Four-Piece Logs Are Mandatory

status: active  
tier: P0  
enforcementMode: machine-blocking

每一次 AI 模型调用必须按顺序发出：

```txt
AI_REQUEST_DEBUG       before model call
AI_RAW_RESPONSE_DEBUG  after model return, before parse/discard
AI_PARSE_RESULT_DEBUG  after JSON extraction/schema validation
AI_ERROR_DEBUG         before AI failure escapes
```

AI_REQUEST_DEBUG 必须包含：

```txt
promptContractId?
promptContractVersion?
modelName
runtimeName
outputSchemaRef?
promptHash
promptPreview
imageRefs?
imageHashes?
missionId?
roundId?
stepId?
traceId
spanId
```

AI_RAW_RESPONSE_DEBUG 必须包含：

```txt
rawResponseHash
rawResponsePreview
durationMs
status
```

AI_PARSE_RESULT_DEBUG 必须包含：

```txt
schemaStatus
parserErrors
actionCount
schemaIssueCount
durationMs
```

AI_ERROR_DEBUG 必须包含：

```txt
errorKind
failureReason
ownerResponsible
actionableMessage
```

禁止：

```txt
callLocalModel before AI_REQUEST_DEBUG
discard raw response before AI_RAW_RESPONSE_DEBUG
parse result without AI_PARSE_RESULT_DEBUG
AI failure without AI_ERROR_DEBUG
only promptLength without promptHash
```

---

### LAW-RLS-005: Terminal Is Not Truth

status: active  
tier: P0  
enforcementMode: machine-blocking

终端只是实时显示。

必须：

```txt
FLOW terminal: one-line flow summary.
DEBUG terminal: summary + refs/hash/preview.
TRACE terminal: more fields but still redacted.
```

长期调试证据必须进入：

```txt
data/runtime-logs/<missionId>/<runId>.jsonl
```

或开发环境：

```txt
tmp/runtime-logs/<runId>.jsonl
```

如需进入长期取证，由调用方通过 Forensics public API 保存 refs。

禁止：

```txt
terminal output as truth
console.log as proof
logger direct write Forensics private storage
full secrets in terminal
base64 image in terminal
```

---

### LAW-RLS-006: Redaction Is Mandatory

status: active  
tier: P0  
enforcementMode: machine-blocking

禁止明文进入 terminal 或 debug bundle：

```txt
cookies
tokens
authorization headers
passwords
API keys
session cookies
base64 image content
private secrets
```

允许：

```txt
hash
size
dimensions
artifactRef
file basename
redacted path
preview after redaction
```

所有 file sink 写入前必须经过：

```txt
redactRuntimeLogPayload()
```

禁止：

```txt
直接写 payload 到 file sink。
直接把 raw prompt/raw response 打到 terminal。
```

---

### LAW-RLS-007: Console Scatter Is Forbidden

status: active  
tier: P0  
enforcementMode: machine-blocking

禁止在生产 source 中散落：

```txt
console.log
console.error
console.warn
console.debug
```

允许的唯一位置：

```txt
src/lib/runtime-logs/sinks.ts
CLI entrypoint 必要输出
```

能力组、runtime、AI、local-ai、orchestration 中不得出现 console 临时补丁。

---

### LAW-RLS-008: Runtime Logging Inspector Must Stay Small

status: active  
tier: P0  
enforcementMode: machine-blocking

```txt
src/lib/runtime-logs <= 8 files
scripts/audit/domains/runtime-logging <= 3 files
each logging inspector file <= 250 lines
```

Runtime Logging inspector 只检查：

```txt
法案 active
文件数
事件字段
FLOW/DEBUG/TRACE
redaction
AI 四件套
console scatter
logger 不越权
LocalAiDebugHook 退役
```

禁止：

```txt
日志 dashboard
大型日志 inventory
metrics system
event bus
tracing vendor SDK
owner-inspection-harness
```

---

## 3. Canonical Event Families

只允许少量 canonical event type。

```txt
HUMAN_COMMAND_RECEIVED
HUMAN_COMMAND_VALIDATED
HUMAN_COMMAND_REJECTED

MISSION_STARTED
MISSION_STOPPED
MISSION_COMPLETED
MISSION_REVIEW_REQUIRED
ROUND_STARTED
ROUND_COMPLETED

SCREENSHOT_CAPTURE_REQUESTED
SCREENSHOT_CAPTURED
COORDINATE_GRID_RENDERED

AI_REQUEST_DEBUG
AI_RAW_RESPONSE_DEBUG
AI_PARSE_RESULT_DEBUG
AI_ERROR_DEBUG
AI_DECISION_SUMMARY

CAPABILITY_DISPATCH_STARTED
CAPABILITY_DISPATCH_COMPLETED
CAPABILITY_DISPATCH_FAILED

GEOMETRY_GUARD_RESULT
BROWSER_ACTION_RESULT
TEXT_INPUT_RESULT
OPEN_RESULT

FORENSICS_RECORD_APPENDED
FORENSICS_ARTIFACT_APPENDED

APP_SHELL_HEALTH
MISSION_READINESS
SERVICE_EXIT
```

新增 event type 必须：

```txt
先修改 event-types.ts
说明 modeVisibility
说明 owner
说明用途
```

---

## 4. Required Code Structure

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

最多 8 个文件。

Public API 只允许：

```txt
createRuntimeLogger()
emitRuntimeLog()
createTraceContext()
withRuntimeSpan()
redactRuntimeLogPayload()
```

---

## 5. PASS Definition

只有全部满足才 PASS：

```txt
1. module-structured-logging 是 active，不是 retired-only。
2. src/lib/runtime-logs <= 8 文件。
3. runtime-logging audit <= 3 文件。
4. RuntimeLogEvent 有固定字段。
5. FLOW/DEBUG/TRACE 存在且 FLOW 默认。
6. AI 四件套存在且按顺序。
7. redaction 存在且 file sink 前强制使用。
8. console scatter 被阻断。
9. logger 不 import private runtime。
10. logger 不成为 persistence owner。
11. LocalAiDebugHook/detail-only debug 不再是主线。
12. PASS 输出短。
13. FAIL 输出可修。
```

---

## 6. Final Sentence

```txt
GrassEye Runtime Log Spine 不负责让系统正确；
它负责让系统出错时绝不失明。
```
