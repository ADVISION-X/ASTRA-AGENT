# GrassEye Nerve Bus 神经网络传输能力组施工图 FINAL

## 0. 文件身份

```yaml
documentId: GRASSEYE-NERVE-BUS-BLUEPRINT-FINAL
owner: nerve-bus-capability
documentType: construction-blueprint
lawAuthority: module-nerve-bus-capability.instructions.md
architecturePhase: Static Capability Package Architecture
status: active
replace:
  - docs/法案辅助文件/GrassEye Nerve Bus 神经网络传输能力组施工图.md
mustNotCreate:
  - new lawId
  - new ability group
  - platform-specific channel
  - business-specific channel
  - second transport owner
  - direct Orchestration transport
  - direct Ability-to-Ability route
```

本施工图是 `module-nerve-bus-capability.instructions.md` 的建设级落地映射。  
本施工图不新增 lawId，不修改 14 个能力组主权，不重新分配 owner。  
若本文档与 Nerve Bus 法案冲突，以 Nerve Bus 法案为最高权威。

---

## 1. 定位

Nerve Bus 是 GrassEye 的神经传输层。

它只负责：

```txt
包装 Envelope
验证 Envelope
验证 Channel
验证 idempotency / sequence / queue / timeout
通过 HandlerPort 调度
接收 typed ResultEnvelope
执行 Result Semantic Gate
生成 Transfer Proof
返回 Transport Result
```

它不负责：

```txt
选择地图
决定下一步
评估 branch
生成 prompt
选择 AI provider
执行 AI model
执行浏览器动作
执行点击/滚动/输入
判断页面状态
写 Forensics storage
完成 mission finalization
```

一句话：

```txt
Nerve Bus 负责“把受治理命令送到正确对象，并把结果带证明送回来”。
它不是大脑，不是动作手，不是地图解释器，不是证据库。
```

---

## 2. 故事链路位置

```txt
Commander Console
→ Nerve Bus
→ Orchestration
→ Nerve Bus
→ Ability Group / AI
→ Nerve Bus
→ Orchestration
→ Nerve Bus
→ Commander / Forensics request path
```

Nerve Bus 在每一次跨 owner 通讯中只做传输，不做业务判断。

---

## 3. 标准包结构

```txt
src/capabilities/nerve-bus/
├── ability-group.ts
├── contract.ts
├── schema.ts
├── registry.ts
├── index.ts
├── ports/
│   ├── nerve-bus-clock-port.ts
│   ├── nerve-bus-handler-port.ts
│   ├── nerve-bus-idempotency-port.ts
│   ├── nerve-bus-queue-port.ts
│   ├── nerve-bus-sequence-port.ts
│   └── nerve-bus-transport-port.ts
├── shared/
│   ├── nerve-bus-channel.ts
│   ├── nerve-bus-envelope.ts
│   ├── nerve-bus-failure.ts
│   ├── nerve-bus-policy.ts
│   ├── nerve-bus-proof.ts
│   ├── nerve-bus-result.ts
│   └── nerve-bus-routing-types.ts
├── runtime/
│   ├── envelope-input-gate.ts
│   ├── channel-policy-gate.ts
│   ├── envelope-integrity-gate.ts
│   ├── transport-idempotency-gate.ts
│   ├── transport-sequence-policy.ts
│   ├── transport-queue.ts
│   ├── transport-timeout-gate.ts
│   ├── transport-runner.ts
│   ├── transport-result-semantic-gate.ts
│   ├── transport-proof-builder.ts
│   ├── transport-result-builder.ts
│   ├── transport-failure-finalizer.ts
│   ├── transport-validation-orchestrator.ts
│   └── nerve-bus-executor.ts
└── children/
    ├── commander-to-orchestration/
    ├── orchestration-to-commander/
    ├── orchestration-to-ability/
    ├── ability-to-orchestration/
    ├── orchestration-to-ai/
    └── ai-to-orchestration/
```

禁止：

```txt
facebook-to-orchestration
tiktok-to-orchestration
ability-to-ability
ai-to-ability
commander-to-ability
click-next-video-arrow
product-video-detection
capability-check.ts
verify-*.ts as release gate
```

---

## 4. 六条 canonical channel

| channelId | from | to | 作用 |
|---|---|---|---|
| commander-to-orchestration | commander-console | orchestration | 人类任务命令进入总调度 |
| orchestration-to-commander | orchestration | commander-console | review/status/人工复核请求返回 |
| orchestration-to-ability | orchestration | active ability group | 调度能力组执行步骤 |
| ability-to-orchestration | active ability group | orchestration | 能力组结果回传 |
| orchestration-to-ai | orchestration | ai | AI request |
| ai-to-orchestration | ai | orchestration | AI response |

通道是传输路线，不是业务路线。  
不得新增平台/业务专用通道。

---

## 5. Public Contract

推荐 public interface：

```ts
interface NerveBusAbilityGroup {
  listChannelIds(): NerveBusChannelId[];

  transportEnvelope(input: NerveBusTransportInput): Promise<NerveBusTransportResult>;

  dispatchHumanCommand(input: HumanCommandDispatchInput): Promise<HumanCommandTransportResult>;
  dispatchAbilityCommand(input: AbilityCommandDispatchInput): Promise<AbilityTransportResult>;
  dispatchAbilityResult(input: AbilityResultDispatchInput): Promise<AbilityTransportResult>;
  requestAi(input: AiRequestDispatchInput): Promise<AiTransportResult>;
  dispatchAiResponse(input: AiResponseDispatchInput): Promise<AiTransportResult>;
  dispatchCommanderMessage(input: CommanderMessageDispatchInput): Promise<HumanCommandTransportResult>;
}
```

允许保留显式方法，但最终必须保证六条逻辑通道都有入口、schema、registry、runtime、proof、inspector 覆盖。

禁止 public contract 暴露：

```txt
Orchestration implementation
Ability child implementation
AI provider adapter
BrowserController
primitive ports
Forensics writer
raw platform adapters
secret resolver
```

---

## 6. Envelope Base Model

所有 envelope 必须包含：

```yaml
NerveBusEnvelopeBase:
  abilityGroupId: nerve-bus
  channelId: required
  envelopeKind: required
  envelopeId: required
  nerveBusEnvelopeId: required
  transportId: required
  traceId: required
  spanId: required
  attemptId: required
  missionId: required
  runId: required
  sessionId: required
  roundId: optional
  videoVisitId: optional
  stepId: required
  mapPackageId: required
  mapPackageVersion: required
  selectedMapId: required
  selectedMapVersion: required
  activationId: required
  activationSnapshotRef: required
  capabilityCallId: required
  sourceRef: required
  inputRef: required
  payloadRef: non-empty list
  idempotencyKey: required
  sequenceNo: required
  createdAt: required
  expiresAt: required
```

规则：

```txt
envelopeId 与 nerveBusEnvelopeId 必须一致或明确 alias。
valid mission transport 中 activationSnapshotRef 不得为空。
valid step dispatch 中 capabilityCallId 不得为空。
payloadRef 必须非空。
```

---

## 7. Human Command Envelope

`commander-to-orchestration` 必须额外包含：

```yaml
HumanCommandEnvelope:
  commandId: required
  from: commander-console
  to: orchestration
  commandType: required
  commanderCommandRef: required
  commanderEnvelopeRef: required
  requestedPlatformId: required-if-start
  selectedMapId: optional
  taskTemplateId: optional
  activationId: optional
  targetRecordRef: optional
```

禁止：

```txt
Nerve Bus 补 requestedPlatformId 默认值
Nerve Bus 补 selectedMapId 默认值
Human command 缺 commanderEnvelopeRef 仍成功
```

---

## 8. Ability Command Envelope

`orchestration-to-ability` 必须额外包含：

```yaml
AbilityCommandEnvelope:
  commandId: required
  from: orchestration
  to: active ability group
  commandName: required
  targetAbilityGroupId: required
  targetChildCapabilityId: required
  capabilityInputRef: required
  expectedOutputSchemaRef: required
  postActionVerificationRequired: required-when-action-ability
```

禁止：

```txt
to 与 targetAbilityGroupId 不一致
缺 targetChildCapabilityId
缺 capabilityCallId
缺 expectedOutputSchemaRef
动作能力缺 PAV policy
```

---

## 9. AI Request Envelope

`orchestration-to-ai` 必须额外包含：

```yaml
AiRequestEnvelope:
  requestId: required
  from: orchestration
  to: ai
  taskType: required
  promptContractId: required
  promptContractVersion: required
  outputSchemaRef: required
  aiInputRefs: non-empty list
  modelPolicyRef: optional
  providerPolicyRef: optional
```

禁止：

```txt
promptRef 作为最终 prompt truth
rawPrompt
systemPrompt
userPrompt
promptText
Nerve Bus 选择 AI provider
Nerve Bus 读取 API key
```

---

## 10. Result Envelopes

Result status：

```txt
success
failed
review_required
```

Success 必须：

```txt
outputRef exists
proofRef exists
result payload traceable through payloadRef
request/result chain parity
```

Failed 必须：

```txt
failureReason exists
diagnosticPayloadRef or proofRef exists
```

Review required 必须：

```txt
reviewRequiredReason exists
diagnosticPayloadRef or proofRef exists
```

禁止：

```txt
boolean result
null success
undefined success
status=ok
status=persisted
raw provider result
raw ability result
business fields such as nextStepId/productDecision/actionVerified
```

---

## 11. Runtime Pipeline

每次 transport 必须固定：

```txt
input schema gate
→ channel registry gate
→ channel policy gate
→ envelope integrity gate
→ idempotency reservation gate
→ sequence gate
→ queue gate
→ timeout/cancellation gate
→ handler port dispatch
→ result envelope schema gate
→ result semantic gate
→ payload binding/output write
→ transfer proof builder
→ transport result builder
→ idempotency commit/release
```

禁止：

```txt
handler dispatch before gates
retry loop
fallback route
catch-and-swallow
raw handler passthrough
naked throw escaping public boundary
```

---

## 12. Handler Port

Nerve Bus 只能通过 `NerveBusHandlerPort` 触达目标 owner。

HandlerPort 必须支持：

```txt
dispatchHumanCommand
dispatchAbilityCommand
dispatchAbilityResult
requestAi
dispatchAiResponse
dispatchCommanderMessage
```

若某方向采用 request/response 同步返回，也必须保持逻辑通道和 proof 覆盖，不得丢失 result channel 语义。

Handler call 必须带：

```txt
AbortSignal
envelope
inputPayload
```

---

## 13. Timeout / Abort

要求：

```txt
每次 handler dispatch 创建 AbortController。
AbortSignal 传给 HandlerPort。
timeout 触发 abort。
timeout 返回 typed failed/review。
late success 不得覆盖 timeout failure。
timeoutDecision 写入 proof。
```

---

## 14. Idempotency / Sequence / Queue

Idempotency：

```txt
idempotencyKey 必填
duplicate in-flight fail/review
completed duplicate 可返回 cached result，但必须 proof parity
reservation failure 不得 dispatch handler
```

Sequence：

```txt
sequenceNo 必填
strict monotonic
out-of-order 不得 dispatch handler
```

Queue：

```txt
queue rejected 不得 dispatch handler
```

---

## 15. Transfer Proof

`NerveBusTransportProof` 必须包含：

```yaml
proofId: required
abilityGroupId: nerve-bus
channelId: required
envelopeKind: required
envelopeId: required
nerveBusEnvelopeId: required
correlationEnvelopeId: required
transportId: required
traceId: required
spanId: required
attemptId: required
missionId: required
runId: required
sessionId: required
roundId: optional
videoVisitId: optional
stepId: required
mapPackageId: required
mapPackageVersion: required
selectedMapId: required
selectedMapVersion: required
activationId: required
activationSnapshotRef: required
capabilityCallId: required
sourceRef: required
inputRef: required
payloadRef: required
outputRef: optional
diagnosticPayloadRef: optional
from: required
to: required
targetAbilityGroupId: optional
targetChildCapabilityId: optional
promptContractId: optional
promptContractVersion: optional
outputSchemaRef: optional
idempotencyKey: required
sequenceNo: required
policyDecision: required
integrityDecision: required
idempotencyDecision: required
sequenceDecision: required
queueDecision: required
timeoutDecision: required
handlerDecision: required
semanticDecision: required
handlerCallId: required-if-handler-invoked
handlerStartedAt: required-if-handler-invoked
handlerEndedAt: required-if-handler-invoked
handlerDurationMs: required-if-handler-invoked
circuitBreakerState: required
startedAt: required
endedAt: required
durationMs: required
status: required
failureReason: optional
reviewRequiredReason: optional
dataQualityFlags: list
```

禁止：

```txt
raw prompt body
API key
raw image base64
raw provider payload body
```

---

## 16. Children

必须存在：

```txt
commander-to-orchestration
orchestration-to-commander
orchestration-to-ability
ability-to-orchestration
orchestration-to-ai
ai-to-orchestration
```

每个 child 必须：

```txt
have contract/schema/implementation
bind exactly one channel
use unified runtime
not import foreign owner runtime
not build final proof directly outside proof builder
not return boolean/null
```

---

## 17. 与其它能力组边界

### Commander Console

Commander 生成 HumanCommandEnvelope。  
Nerve Bus 传输。  
Nerve Bus 不解释用户意图。

### Orchestration

Orchestration 生成 ability/AI command envelopes。  
Nerve Bus 传输。  
Nerve Bus 不选择 next step。

### AI

AI 执行 prompt contract。  
Nerve Bus 只传 promptContractId/outputSchemaRef/refs。  
Nerve Bus 不选 provider，不读 secret。

### Ability Groups

能力组执行自己的窄能力。  
Nerve Bus 不执行能力内部逻辑。

### Forensics

Forensics 记账存证。  
Nerve Bus 只传 refs/proof，不写 storage。

---

## 18. 执法系统

必须存在：

```txt
scripts/audit/domains/nerve-bus-capability/manifest.json
scripts/audit/domains/nerve-bus-capability/inspector.ts
scripts/audit/domains/nerve-bus-capability/run-inspector.ts
scripts/audit/domains/nerve-bus-capability/owner-inspection-harness.ts
```

Inspector 必须：

```txt
ts-morph
AST-level
symbol-level
import graph-level
schema-level
anti-escape
runner-connected
real-code-inspection-backed
```

---

## 19. Inspector 必查

```txt
1. Law file is machine-blocking.
2. Six channel exact set.
3. Envelope base chain fields complete.
4. AI request requires promptContractId/outputSchemaRef.
5. Ability command requires targetAbilityGroupId/targetChildCapabilityId/capabilityCallId.
6. No transport default injection.
7. No direct cross-owner calls.
8. No business decision fields.
9. Fixed pipeline gates exist in order.
10. AbortSignal/timeout enforced.
11. No retry/fallback path.
12. Result semantic gate enforced.
13. Result/proof/envelope parity.
14. Children use unified runtime.
15. No forbidden imports/symbols.
16. No raw prompt/API key/raw image leakage.
17. ALL active laws in registry/matrix/audit-plan/runner.
18. real-code-inspection executed.
```

---

## 20. real-code-inspection 最低清单

必须 fail → re-inspect → pass：

```txt
manual-first enforcement reintroduced
remove activationSnapshotRef from envelope
remove runId from envelope
remove capabilityCallId from ability command
AI request without promptContractId
AI request without outputSchemaRef
add rawPrompt to envelope
result mismatches request runId
success without outputRef
failure without failureReason
child returns boolean
child imports Orchestration runtime
Orchestration directly imports ability child implementation
Commander directly calls Orchestration execute
add platform-specific channel
remove required channel
remove AbortSignal
add retry loop
add nextStepId to transport result
add API key-like value to proof
capability-check.ts added
remove real-code-inspection invocation
turn P0 into warning-only
```

---

## 21. READY 标准

Nerve Bus READY 仅当：

```txt
Nerve Bus 法案 / 施工图 / inspector / generated / runner 口径一致
ALL active law enforcement PASS
CI-FULL PASS
six channels complete
envelope full chain required
AI request uses promptContractId/outputSchemaRef
no default injection
no business decisions
no direct cross-owner calls
fixed pipeline gates enforced
AbortSignal/timeout/idempotency/sequence/queue enforced
result semantic gate blocks bad result
transfer proof full-chain and secret-safe
children are narrow channel bindings
real-code-inspection PASS
```

---

## 22. 漂移信号

```txt
Nerve Bus envelope lacks activationSnapshotRef
Nerve Bus envelope lacks runId/sessionId
ability command lacks capabilityCallId
AI request still uses promptRef without promptContractId
Nerve Bus injects default platform/map
Nerve Bus contains nextStepId
Nerve Bus imports Orchestration runtime
Nerve Bus imports ability child implementation
Nerve Bus imports AI provider secret resolver
success result lacks outputRef
proof contains raw prompt/API key/base64
verify script becomes release gate
```

---

## 23. 最终原则

```txt
Commander 说：用户命令是什么。
Orchestration 说：下一步该调谁。
Nerve Bus 说：我把 envelope 送过去，并带 proof 回来。
Ability Group 说：我执行自己的窄能力。
AI 说：我按 Prompt Contract 输出结果。
Forensics 说：我记账存证。
这些不能混。
```
