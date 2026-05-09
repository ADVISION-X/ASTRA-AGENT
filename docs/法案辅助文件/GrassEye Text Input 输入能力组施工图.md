# GrassEye Text Input 输入能力组施工图 FINAL

## 0. 文件身份

```yaml
documentId: GRASSEYE-TEXT-INPUT-BLUEPRINT-FINAL
owner: text-input-capability
documentType: construction-blueprint
lawAuthority: module-text-input-capability.instructions.md
architecturePhase: Static Capability Package Architecture
status: active
replace:
  - docs/法案辅助文件/GrassEye Text Input 输入能力组施工图.md
mustNotCreate:
  - new lawId
  - new ability group
  - text-generation owner
  - target-detection owner
  - page-state verification owner
  - browser-session owner
  - clipboard persistence owner
  - send-message child
  - publish child
```

本施工图是 `module-text-input-capability.instructions.md` 的建设级落地映射。  
本施工图不新增 lawId，不修改 14 个能力组主权，不重新分配 owner。  
若本文档与 Text Input 法案冲突，以 Text Input 法案为最高权威。

---

## 1. 定位

Text Input 是 GrassEye 的正式独立输入能力组。

它只负责：

```txt
接收已批准文本
接收已验证输入目标
接收已验证焦点/可输入证明
执行 type / paste / clear / replace / press-key / commit
生成 actionExecutionRef / primitiveExecutionRef
生成 runtimeProof
生成 postActionVerificationHandoffRef
```

它不负责：

```txt
生成文本
选择联系人
判断要不要发送
查找输入框
计算坐标
点击聚焦
判断页面是否接受输入
判断发送/发布是否成功
管理浏览器会话/cookie/token
持久化剪贴板内容
写 Forensics storage
```

一句话：

```txt
Text Input 是“写字的手”，不是“大脑”、不是“眼睛”、不是“裁判”。
```

---

## 2. 故事链路位置

```txt
AI / Commander / Orchestration 生成或批准文本
→ Visual Target / Geometry Guard / Mouse Click / Page State / PAV 给出输入目标与焦点证明
→ Nerve Bus 传输 Text Input command
→ Text Input 执行受治理写入
→ Post-action Verification 验证输入效果
→ Forensics 记录最终证据
```

---

## 3. 标准包结构

```txt
src/capabilities/text-input/
├── ability-group.ts
├── contract.ts
├── schema.ts
├── registry.ts
├── index.ts
├── ports/
│   ├── text-input-execution-port.ts
│   ├── clipboard-port.ts
│   └── text-input-clock-port.ts
├── shared/
│   ├── text-input-failure.ts
│   ├── text-input-policy.ts
│   ├── text-input-proof.ts
│   ├── text-input-redaction.ts
│   ├── text-input-result.ts
│   ├── text-input-source.ts
│   ├── text-input-target.ts
│   └── text-input-types.ts
├── runtime/
│   ├── text-input-input-gate.ts
│   ├── approved-text-gate.ts
│   ├── text-source-proof-gate.ts
│   ├── input-target-proof-gate.ts
│   ├── focus-proof-gate.ts
│   ├── text-policy-gate.ts
│   ├── sensitive-text-gate.ts
│   ├── key-policy-gate.ts
│   ├── commit-policy-gate.ts
│   ├── clipboard-policy-gate.ts
│   ├── text-input-execution-gates.ts
│   ├── text-input-executor.ts
│   ├── text-input-executor-single.ts
│   ├── text-input-executor-replace.ts
│   ├── primitive-text-input-runner.ts
│   ├── text-input-output-boundary-gate.ts
│   ├── text-input-proof-builder.ts
│   └── text-input-result-builder.ts
└── children/
    ├── type-text/
    ├── paste-text/
    ├── clear-input/
    ├── replace-input/
    ├── press-key/
    └── commit-input/
```

禁止：

```txt
send-message
publish
select-recipient
locate-input
read-input
browser-specific child
platform-specific child
compat/
legacy/
bridge/
v2/
capability-check.ts
verify-*.ts as release truth
```

---

## 4. Public Contract

Public interface 只允许：

```ts
interface TextInputAbilityGroup {
  listChildCapabilityIds(): TextInputChildCapabilityId[];
  execute(input: TextInputAbilityInput): Promise<TextInputAbilityResult>;
}
```

允许 public exports：

```txt
createTextInputAbilityGroup
TEXT_INPUT_ABILITY_GROUP_ID
TextInputAbilityInput
TextInputAbilityResult
TextInputRuntimeProof
TextInputExecutionPort type
ClipboardPort type
TextInputClockPort type
TextInput child ids/types/schemas
```

禁止 public exports/imports：

```txt
BrowserController
DOM selector
CSS selector
querySelector
AppleScript/JXA primitive
raw browser action result
raw clipboard value
child implementation as public API
runtime executor internals as public API
```

---

## 5. Input Model

`TextInputAbilityInput` 必须包含：

```yaml
TextInputAbilityInput:
  abilityGroupId: text-input
  childCapabilityId: type-text | paste-text | clear-input | replace-input | press-key | commit-input
  requestedBy: required
  purpose: required
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
  nerveBusEnvelopeId: required
  sourceAbilityGroupId: required
  sourceChildCapabilityId: optional
  sourceOwner: commander-console | orchestration | ai | map-policy | human-approval
  sourceProofRef: required
  sourceRef: required
  inputRef: required
  idempotencyKey: required
```

Target / focus fields：

```yaml
inputTargetRef: required
targetRef: required
targetProofRef: required
targetProofOwner: visual-target | geometry-guard | mouse-click | page-state | post-action-verification
targetKind: textField | searchField | commentComposer | editableArea
targetEvidenceRefs: list
focusProofRef: required
focusProofOwner: post-action-verification | page-state | mouse-click
focusVerifiedAt: required
geometryGuardProofRef: required-when-geometry-required
mouseClickProofRef: required-when-click-focus-required
postActionFocusVerificationRef: required
```

Write fields for type/paste/replace：

```yaml
inputText: required
inputTextRef: required
inputTextHash: required
approvedText: required
approvedTextRef: required
approvedTextHash: required
approvedTextSourceRef: required
approvedTextApprovalRef: required
```

Rules：

```txt
inputText === approvedText
hash(inputText) === inputTextHash
hash(approvedText) === approvedTextHash
inputTextHash === approvedTextHash
```

Hash canonical detail：

```txt
Text Input 所有 proof/result hash 字段必须使用 schema-canonical SHA-256 字符串：
sha256:<64 lowercase hex>

typedTextHash 和 keySequenceHash 必须由 TextInputExecutionPort adapter 的同一 canonical hash helper 生成。
禁止 primitive adapter 返回裸 64 位 hex，禁止在 result/proof builder 中补前缀或吞掉不合法 hash。
```

---

## 6. Child Capability Rules

| child | required | forbidden |
|---|---|---|
| type-text | approved text + verified target/focus | clipboard |
| paste-text | approved text + clipboard policy | persistent clipboard truth |
| clear-input | verified target/focus | approved text requirement |
| replace-input | clear then write in one governed result | write without clear |
| press-key | governed non-commit key enum | arbitrary key / Enter commit |
| commit-input | approvedCommitRef + commit policy | default commit |

---

## 7. Runtime Pipeline

固定执行链：

```txt
input schema gate
→ child registry gate
→ approved text gate
→ text source proof gate
→ input target proof gate
→ focus proof gate
→ text policy gate
→ sensitive text gate
→ key/commit policy gate
→ clipboard policy gate
→ output boundary preflight
→ primitive execution plan
→ timeout/cancellation gate
→ execution port call
→ clipboard restore/clear when paste used
→ primitive result semantic gate
→ PAV handoff builder
→ output boundary gate
→ proof builder
→ result builder
```

禁止：

```txt
primitive call before gates
retry/fallback hidden path
catch-and-swallow success
no-op success
null success
```

---

## 8. Ports

### TextInputExecutionPort

负责 type/paste/clear/replace/press-key/commit 的真实 primitive execution。

必须接收：

```txt
attemptRef
actionExecutionRef
childCapabilityId
targetRef
targetKind
inputText or key
inputTextHash
timeoutMs
abortSignal
```

### ClipboardPort

只用于 paste-text subordinate transport。

必须：

```txt
read backup
write approved text
restore original or clear
record hashes/refs only
never persist raw clipboard text
```

### TextInputClockPort

唯一时间来源。  
runtime/child 不得散落 Date.now/performance.now/new Date。

---

## 9. Sensitive Text / Redaction

必须遵守：

```txt
raw text only exists inside governed request scope
proof/log/debug stores refs/hashes/redacted preview only
sensitive text requires approval according to policy
clipboard raw text never enters proof/log
diagnostic payload never stores raw sensitive text
repair-packet never stores raw sensitive text
```

Default：

```txt
redaction mode = masked
commit requires approval
sensitive write blocked or review_required
```

---

## 10. Result Model

Success output 必须包含：

```yaml
attemptRef
actionExecutionRef
primitiveExecutionRef
targetRef
targetKind
actionKind
inputTextRef
inputTextHash
approvedTextRef
approvedTextHash
typedTextHash or keySequenceHash or clear/write primitive refs
textLength
key
postActionVerificationRequired: true
postActionVerificationHandoffRef
```

Failure/review：

```txt
output = null
diagnosticPayloadRef required
failureReason or reviewRequiredReason required
runtimeProof required
```

禁止结果字段：

```txt
pageStateVerified
fieldContentVerified
submissionSuccess
publishSuccess
sendSuccess
actionVerified
finalPageAccepted
nextStepId
productDecision
finalActionLogRef
browserActionId
browserActionResult
fallbackUsed
retryCount
```

---

## 11. owner evidence

`TextInputRuntimeProof` 必须包含完整链路：

```yaml
proofId: required
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
nerveBusEnvelopeId: required
abilityGroupId: text-input
childCapabilityId: required
sourceAbilityGroupId: required
sourceChildCapabilityId: optional
sourceOwner: required
sourceProofRef: required
sourceRef: required
inputRef: required
outputRef: required-if-success
diagnosticPayloadRef: required-if-not-success
attemptRef: required
actionExecutionRef: required-if-success
primitiveExecutionRef: required-if-success
clearPrimitiveExecutionRef: optional
writePrimitiveExecutionRef: optional
operationRef: optional
inputTextRef: optional
inputTextHash: optional
approvedTextRef: optional
approvedTextHash: optional
typedTextHash: optional
keySequenceHash: optional
approvedCommitRef: optional
inputTargetRef: required
targetRef: required
targetProofRef: required
targetProofOwner: required
targetKind: required
targetEvidenceRefs: list
focusProofRef: required
focusProofOwner: required
focusVerifiedAt: required
geometryGuardProofRef: optional
mouseClickProofRef: optional
postActionFocusVerificationRef: required
policyDecision: required
sensitiveTextDecision: required
redactionDecision: required
keyPolicyDecision: required
commitPolicyRef: optional
clipboardDecision: required
clipboardSnapshotRef: optional
clipboardProofRef: optional
originalClipboardHash: optional
restoredClipboardHash: optional
primitiveDecision: required
primitivePortKind: required
replaceWriteMode: optional
primitiveStartedAt: optional
primitiveEndedAt: optional
maxDurationMs: required
primitiveTimeoutMs: required
postActionVerificationRequired: true
postActionVerificationHandoffRef: required-if-success
verificationRefPolicy: required
startedAt: required
endedAt: required
durationMs: required
status: required
failureReason: optional
reviewRequiredReason: optional
dataQualityFlags: list
clock: required
```

禁止：

```txt
fabricated runId from attemptRef
missionId=sessionId fallback
runtimeProof:null
raw input text
raw approved text
raw clipboard text
```

---

## 12. 执法系统

必须存在：

```txt
scripts/audit/domains/text-input-capability/manifest.json
scripts/audit/domains/text-input-capability/inspector.ts
scripts/audit/domains/text-input-capability/run-inspector.ts
scripts/audit/domains/text-input-capability/owner-inspection-harness.ts
```

Inspector 必查：

```txt
1. Law file machine-blocking.
2. Public contract write-only and port-based.
3. Input schema full chain fields.
4. Approved text/hash/ref gate.
5. Target/focus proof gate.
6. Clipboard transient lifecycle.
7. Sensitive text redaction.
8. Commit/press-key policy.
9. Execution only through TextInputExecutionPort.
10. AbortSignal/timeout.
11. No retry/fallback/no-op success.
12. Success requires PAV handoff.
13. Result/proof/input parity.
14. Six children exact.
15. No raw text/clipboard/API key leakage.
16. ALL active laws in registry/matrix/audit-plan/runner.
17. real-code-inspection executed.
18. TextInputExecutionPort adapter output hashes are schema-canonical `sha256:<64 hex>` by AST inspection.
```

real-code-inspection minimum：

```txt
manual-first enforcement reintroduced
remove activationSnapshotRef from input
remove nerveBusEnvelopeId from input
remove capabilityCallId from input
type-text without approvedTextRef
inputTextHash mismatches approvedTextHash but succeeds
press-key accepts arbitrary key
commit-input without approvedCommitRef succeeds
paste-text persists clipboard plaintext
runtimeProof contains raw inputText
remove AbortSignal
primitive adapter returns bare 64hex instead of schema-canonical sha256-prefixed hash
add retry loop
success without postActionVerificationHandoffRef
add sendSuccess/pageStateVerified to result
child calls primitive port directly
child imports BrowserController
add send-message child
capability-check.ts added
remove real-code-inspection invocation
turn P0 into warning-only
```

---

## 13. READY 标准

Text Input READY 仅当：

```txt
Text Input 法案 / 施工图 / inspector / generated / runner 口径一致
ALL active law enforcement PASS
CI-FULL PASS
full chain fields required
approved text/hash/ref enforced
target/focus proof enforced
sensitive text redacted
clipboard lifecycle transient and proof-safe
primitive execution only through ports
AbortSignal/timeout enforced
no retry/fallback/no-op success
success requires PAV handoff
result/proof/input parity
six children exact and unified runtime
real-code-inspection PASS
```

---

## 14. 最终原则

```txt
AI/Commander 说：要写什么。
Visual Target/Geometry/Page State/PAV 说：写到哪里、是否聚焦。
Text Input 说：我把已批准文本写进去。
PAV 说：写完页面是否真的接受。
Forensics 说：我记账存证。
这些不能混。
```
