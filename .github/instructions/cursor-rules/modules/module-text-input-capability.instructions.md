---
name: "GrassEye Text Input Capability"
description: "Use when governing the independent Text Input Ability Group, approved text writing, verified input target handoff, governed type/paste/clear/replace/press-key/commit execution, clipboard lifecycle, sensitive text redaction, primitive proof, post-action verification handoff, and the boundary that prevents Text Input from generating text, locating targets, verifying final page state, or owning browser/session truth."
applyTo: ".github/instructions/cursor-rules/modules/module-text-input-capability.instructions.md, src/capabilities/text-input/**, docs/法案辅助文件/GrassEye Text Input 输入能力组施工图.md, scripts/audit/domains/text-input-capability/**"
---

# GrassEye Text Input Capability FINAL

Scope: governs the independent Text Input Ability Group, approved text payload validation, verified input-target and focus handoff, governed type/paste/clear/replace/press-key/commit execution, clipboard lifecycle, sensitive text redaction, primitive write proof, result ownership, and post-action verification handoff.

Boundary: this module governs only writing approved text/key commands into a verified input target through governed ports. It does not govern text generation, prompt authoring, target discovery, coordinate truth, focus discovery, page-state truth, submission success, publish success, browser-session ownership, cookie/token handling, or final outcome verification.

Authority: this file is authoritative only for the `text-input-capability` domain.

Architecture phase: `Static Capability Package Architecture`.

Core doctrine:
- Text Input writes. It does not think, see, click, verify, publish, or store secrets.
- Text Input accepts approved text and verified input target only.
- Text Input never generates message content.
- Text Input never locates a target.
- Text Input never claims page acceptance, submission success, or publish success.
- Text Input success means primitive write/key execution succeeded only.
- PAV verifies the effect after Text Input.
- Clipboard is a subordinate temporary transport for paste only, never persistent truth.
- Raw sensitive text must not leak to proof, logs, Forensics, repair packets, or debug artifacts.
- No verified target, no write.
- No approved text/hash/ref for non-empty write, no write.
- No focus proof, no write.
- No PAV handoff on success, no success.
- No active Text Input law without inspector + runner + negative proof.

---

## Global Text Input Baseline

All active Text Input laws in this file are:

```yaml
status: active
tier: P0
capabilityDomain: text-input-capability
enforcementMode: machine-blocking
evidenceMode: law+inspector+negative-proof
```

Required package:

```txt
src/capabilities/text-input/
├── ability-group.ts
├── contract.ts
├── schema.ts
├── registry.ts
├── index.ts
├── ports/
├── shared/
├── runtime/
└── children/
```

Required children:

```txt
type-text
paste-text
clear-input
replace-input
press-key
commit-input
```

Required enforcement:

```txt
scripts/audit/domains/text-input-capability/
├── manifest.json
├── inspector.ts
├── run-inspector.ts
└── negative-proof-harness.ts
```

Forbidden:
- `manual-first` as active enforcement.
- `evidenceMode: law` as sufficient evidence.
- verify scripts as release truth.
- capability-check.ts under Text Input root.
- detached inspector.
- warning-only P0.
- generated fake PASS.
- empty/missing negative proof.
- text generation inside Text Input.
- selector / DOM locator public contract.
- raw BrowserController public contract.
- raw clipboard value in proof/log/debug.
- raw sensitive text persistence.

---

## Law GRASSEYE-TEXT-INPUT-CAPABILITY-001-V2

status: active  
tier: P0  
capabilityDomain: text-input-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: Text Input is the only owner of governed text/key writing primitives.

### 主题

写字主权唯一

### 法条

Text Input Ability Group is the only owner of governed text/key writing capability.

Required:
- All governed type/paste/clear/replace/press-key/commit execution must flow through `src/capabilities/text-input`.
- Public entry is `TextInputAbilityGroup.execute(input)`.
- Orchestration, Commander, AI, Visual Target, Geometry Guard, Mouse Click, Page State, Post-action Verification, platform adapters, local runtime helpers, BrowserController, DOM helpers, keyboard helpers, and clipboard helpers must not own governed text-writing truth.
- Browser/OS primitive implementations may exist only behind TextInputExecutionPort / ClipboardPort adapters.
- Text Input emits actionExecutionRef, primitiveExecutionRef, runtimeProof, and postActionVerificationHandoffRef.
- Forensics stores final evidence refs; Text Input does not write final storage.

### 禁止

FORBIDDEN:
- Orchestration directly typing/pasting/pressing keys.
- AI directly typing/pasting.
- Mouse Click owning text input.
- platform adapter directly writing text as governed action.
- BrowserController in Text Input public contract.
- DOM selector / CSS query public contract.
- freeform browser script execution.
- legacy keyboard helper as active writing owner.

Required inspector:
- External write-owner scan.
- BrowserController public contract ban.
- DOM selector/CSS query public contract ban.
- Platform direct text-write bypass ban.
- AI/Orchestration direct write ban.

Required negative proof:
- Orchestration imports TextInputExecutionPort adapter directly → FAIL.
- Text Input public contract exposes BrowserController → FAIL.
- Public input accepts selector/querySelector/CSS locator → FAIL.
- Platform adapter writes text outside Text Input → FAIL.

---

## Law GRASSEYE-TEXT-INPUT-CAPABILITY-002-V2

status: active  
tier: P0  
capabilityDomain: text-input-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: Text Input is write-only and must not generate text, locate targets, decide target safety, or verify final page state.

### 主题

纯写字边界

### 法条

Text Input is writing ability only.

Allowed:
- input schema gate.
- approved text gate.
- text hash parity gate.
- target proof gate.
- focus proof gate.
- policy gate.
- sensitive text gate.
- clipboard policy gate.
- primitive write/key execution through ports.
- result/proof builder.
- PAV handoff builder.

Forbidden:
- generating text content.
- editing or improving user/AI text.
- selecting recipients.
- locating input target.
- calculating coordinates.
- validating geometry truth.
- checking whether page accepted the text.
- deciding publish/send success.
- deciding business outcome.
- writing Forensics storage directly.
- owning browser session/cookie/token.
- choosing next step.

Required inspector:
- Forbidden import/symbol scan.
- Prompt/text authoring symbol ban.
- Target detection import ban.
- Page-state/PAV decision field ban.
- Forensics writer import ban.

Required negative proof:
- Text Input builds message text from prompt/user goal → FAIL.
- Text Input imports visual-target runtime → FAIL.
- Text Input emits pageAccepted/publishSuccess/sendSuccess → FAIL.
- Text Input writes Forensics storage directly → FAIL.

---

## Law GRASSEYE-TEXT-INPUT-CAPABILITY-003-V2

status: active  
tier: P0  
capabilityDomain: text-input-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: Text Input input must carry full mission/map/step/capability chain, approved text proof, verified target proof, focus proof, and Nerve Bus envelope refs.

### 主题

输入链路与受批准文本合同

### 法条

Every governed Text Input request must be traceable to the mission/map/step/capability call that requested it.

Required base input fields:

```txt
abilityGroupId = text-input
childCapabilityId
requestedBy
purpose
missionId
runId
sessionId
roundId or visitId
videoVisitId when available
stepId
mapPackageId
mapPackageVersion
selectedMapId
selectedMapVersion
activationId
activationSnapshotRef
capabilityCallId
nerveBusEnvelopeId
sourceAbilityGroupId
sourceChildCapabilityId
sourceOwner
sourceProofRef
sourceRef
inputRef
idempotencyKey
```

Required target/focus fields:

```txt
inputTargetRef
targetRef
targetProofRef
targetProofOwner
targetKind
targetEvidenceRefs
focusProofRef
focusProofOwner
focusVerifiedAt
geometryGuardProofRef when geometry was required
mouseClickProofRef when click/focus was required
postActionFocusVerificationRef
```

Required text fields for non-empty write children (`type-text`, `paste-text`, `replace-input`):

```txt
inputText
inputTextRef
inputTextHash
approvedText
approvedTextRef
approvedTextHash
approvedTextSourceRef
approvedTextApprovalRef
```

Required key fields:
- `press-key` must use governed key enum.
- `commit-input` must use governed commit key enum and approvedCommitRef.
- `press-key` must not use Enter as commit unless explicitly policy-approved through commit-input.
- `clear-input` may omit approvedText fields only because it is clear-only.

Required:
- inputText must exactly match approvedText.
- inputTextHash must equal hash(inputText).
- approvedTextHash must equal hash(approvedText).
- inputTextHash must equal approvedTextHash for write children.
- target/focus proof owners must be from approved upstream owners.
- missing chain fields must fail/review; never success.
- invalid input failure proof may include receivedShapeHash but must not leak raw sensitive text.

### 禁止

FORBIDDEN:
- success with missing missionId/runId/stepId.
- success with missing activationSnapshotRef.
- success with missing capabilityCallId.
- success with missing nerveBusEnvelopeId.
- write success without approvedTextRef.
- write success without inputTextHash/approvedTextHash parity.
- raw arbitrary key string.
- selector/CSS/DOM locator in input contract.
- unbounded Record<string, unknown> public payload.
- freeform unknown payload.
- raw approved text in proof/log/debug when sensitive or policy requires redaction.

Required inspector:
- Input schema chain field check.
- Approved text/hash/ref check.
- Target/focus proof requiredness.
- Key enum check.
- Selector/DOM public contract ban.
- Raw text leakage check.

Required negative proof:
- Remove activationSnapshotRef from input → FAIL.
- Remove nerveBusEnvelopeId from input → FAIL.
- type-text without approvedTextRef → FAIL.
- inputTextHash mismatches approvedTextHash but succeeds → FAIL.
- press-key accepts arbitrary string → FAIL.
- public input includes selector/querySelector → FAIL.

---

## Law GRASSEYE-TEXT-INPUT-CAPABILITY-004-V2

status: active  
tier: P0  
capabilityDomain: text-input-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: Text Input executes only through governed execution, clipboard, and clock ports with AbortSignal/timeout and fail-closed semantics.

### 主题

端口边界与执行流水线

### 法条

Text Input primitive execution must happen only through governed ports.

Required ports:
```txt
TextInputExecutionPort
ClipboardPort
TextInputClockPort
```

Required pipeline:
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

Required:
- Primitive execution must carry AbortSignal.
- Timeout must abort primitive execution.
- Late primitive success after timeout must not overwrite timeout failure.
- `paste-text` may consume ClipboardPort only as subordinate temporary transport.
- Clipboard backup/restore must use hash/ref only in proof.
- All timestamps/duration must come from TextInputClockPort.
- `replace-input` must perform clear then write under one governed result with separate clear/write primitive refs.
- Gate failures must not call primitive port.

### 禁止

FORBIDDEN:
- child implementation constructs BrowserController.
- direct Date.now/performance.now/new Date scatter outside TextInputClockPort adapter.
- retry loop.
- fallback hidden path.
- catch-and-swallow success.
- no-op success.
- null success.
- primitive call after gate failure.
- paste clipboard plaintext persisted beyond request scope.
- clipboard values in logs/proofs/persistent records.

Required inspector:
- Port-only primitive execution check.
- AbortSignal/timeout check.
- Direct clock usage check.
- Gate-before-primitive call order check.
- Clipboard plaintext leakage ban.
- Retry/fallback/no-op ban.

Required negative proof:
- Remove AbortSignal from execution port call → FAIL.
- Add Date.now in runtime child implementation → FAIL.
- paste-text logs clipboard plaintext → FAIL.
- primitive port called before approved text gate → FAIL.
- replace-input writes without clear → FAIL.
- no-op success without primitiveExecutionRef → FAIL.

---

## Law GRASSEYE-TEXT-INPUT-CAPABILITY-005-V2

status: active  
tier: P0  
capabilityDomain: text-input-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: Text Input must treat sensitive text and clipboard content as non-persistent transient material and must record only refs, hashes, redacted previews, and policy decisions.

### 主题

敏感文本与剪贴板生命周期

### 法条

Text Input may temporarily handle raw text only inside governed request scope. Persistent records must store refs/hashes/redacted previews only.

Required:
- Raw text may enter Text Input only as inputText/approvedText for write children.
- Raw text must be compared/hash-verified and then never persisted as raw proof/log/output.
- Debug output may include redactedPreview only.
- Redacted preview must be masked unless policy explicitly allows hash_only/none and non-sensitive classification.
- Sensitive text requires humanApprovalRef and/or mapPolicyApprovalRef according to policy.
- Clipboard backup must be restored or cleared according to policy.
- Clipboard proof must contain snapshot refs/hashes only, never raw clipboard text.
- Clipboard restore failure must downgrade success to review_required.
- Commit/paste actions that can send/publish must require explicit approvedCommitRef/humanApprovalRef/policy approval according to policy.

### 禁止

FORBIDDEN:
- raw inputText/approvedText in runtimeProof.
- raw inputText/approvedText in diagnosticPayloadRef material.
- raw inputText/approvedText in structured runtime event.
- raw clipboard text in proof/log/debug.
- raw secret/API key/password/token in proof/log/debug.
- persistent clipboard plaintext.
- sensitive write without approval when policy requires it.
- commit-input allowed by default.
- Enter commit through press-key when commit policy forbids it.

Required inspector:
- Raw text/proof/log leak scan.
- Clipboard plaintext leak scan.
- Sensitive policy gate check.
- Commit approval gate check.
- Redaction policy check.

Required negative proof:
- runtimeProof contains raw approvedText → FAIL.
- diagnostic/debug material contains raw clipboard backup → FAIL.
- sensitive text writes without humanApprovalRef when required → FAIL.
- commit-input succeeds without approvedCommitRef → FAIL.
- press-key Enter commits when policy disallows → FAIL.

---

## Law GRASSEYE-TEXT-INPUT-CAPABILITY-006-V2

status: active  
tier: P0  
capabilityDomain: text-input-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: Text Input success is primitive write/key success only and must hand off to Post-action Verification.

### 主题

结果真相分离与 PAV handoff

### 法条

Text Input success means governed primitive execution completed without local execution failure only.

Required result semantics:
- `status = success | failed | review_required`.
- Success requires:
  - output exists.
  - outputRef exists.
  - actionExecutionRef exists.
  - primitiveExecutionRef exists.
  - typedTextHash or keySequenceHash or clear/write primitive refs according to child.
  - postActionVerificationRequired = true.
  - postActionVerificationHandoffRef exists.
  - runtimeProof exists.
- Failed/review requires:
  - output = null.
  - diagnosticPayloadRef exists.
  - failureReason or reviewRequiredReason exists.
  - runtimeProof exists.
- Text Input may never claim page-state truth, field content accepted truth, send success, publish success, or submit success.
- PAV or Page State owns post-action verification.

### 禁止

FORBIDDEN result fields:
- pageStateVerified.
- fieldContentVerified.
- submissionSuccess.
- publishSuccess.
- sendSuccess.
- actionVerified.
- finalPageAccepted.
- nextStepId.
- productDecision.
- finalActionLogRef.
- browserActionId.
- browserActionResult.
- fallbackUsed.
- retryCount > 0.

Required inspector:
- Result schema invariant check.
- Success requires PAV handoff.
- Page-state/business result field ban.
- Failure/review output null invariant.
- Runtime proof/result parity.

Required negative proof:
- Success without postActionVerificationHandoffRef → FAIL.
- Add sendSuccess to Text Input result → FAIL.
- Failed result with output → FAIL.
- Success without primitiveExecutionRef → FAIL.
- Text Input claims pageStateVerified → FAIL.

---

## Law GRASSEYE-TEXT-INPUT-CAPABILITY-007-V2

status: active  
tier: P0  
capabilityDomain: text-input-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: Text Input runtime proof must preserve full chain, target proof, focus proof, text proof, clipboard proof, primitive proof, PAV handoff, and redaction decisions.

### 主题

Runtime Proof 全链路完整性

### 法条

Every Text Input result must include runtime proof.

Required proof fields:

```txt
proofId
missionId
runId
sessionId
roundId or visitId
videoVisitId
stepId
mapPackageId
mapPackageVersion
selectedMapId
selectedMapVersion
activationId
activationSnapshotRef
capabilityCallId
nerveBusEnvelopeId
abilityGroupId = text-input
childCapabilityId
sourceAbilityGroupId
sourceChildCapabilityId
sourceOwner
sourceProofRef
sourceRef
inputRef
outputRef or diagnosticPayloadRef
attemptRef
actionExecutionRef
primitiveExecutionRef
clearPrimitiveExecutionRef
writePrimitiveExecutionRef
operationRef
inputTextRef
inputTextHash
approvedTextRef
approvedTextHash
typedTextHash
keySequenceHash
approvedCommitRef
inputTargetRef
targetRef
targetProofRef
targetProofOwner
targetKind
targetEvidenceRefs
focusProofRef
focusProofOwner
focusVerifiedAt
geometryGuardProofRef
mouseClickProofRef
postActionFocusVerificationRef
policyDecision
sensitiveTextDecision
redactionDecision
keyPolicyDecision
commitPolicyRef
clipboardDecision
clipboardSnapshotRef
clipboardProofRef
originalClipboardHash
restoredClipboardHash
primitiveDecision
primitivePortKind
replaceWriteMode
primitiveStartedAt
primitiveEndedAt
maxDurationMs
primitiveTimeoutMs
postActionVerificationRequired
postActionVerificationHandoffRef
verificationRefPolicy
startedAt
endedAt
durationMs
status
failureReason
reviewRequiredReason
dataQualityFlags
clock
```

Required:
- result/proof/input chain parity.
- `runId`, `missionId`, and `stepId` must come from input, not fabricated from attemptRef.
- Success proof requires outputRef/actionExecutionRef/primitiveExecutionRef/PAV handoff.
- Failed/review proof requires diagnosticPayloadRef and no outputRef.
- Raw text must not appear in proof.
- Proof stores refs/hashes/redaction decisions only.

### 禁止

FORBIDDEN:
- runtimeProof:null.
- fabricated runId from attemptRef.
- missionId=sessionId fallback.
- proof without activationSnapshotRef.
- proof without nerveBusEnvelopeId.
- proof without capabilityCallId.
- proof containing raw input text.
- success proof without PAV handoff.
- failed/review proof with outputRef.

Required inspector:
- Proof schema field check.
- Proof/result/input parity.
- No fabricated chain pattern.
- Raw text leakage scan.
- Success/failure invariants.

Required negative proof:
- Remove activationSnapshotRef from proof → FAIL.
- Set runId from attemptRef → FAIL.
- Remove nerveBusEnvelopeId from proof → FAIL.
- Add raw inputText to proof → FAIL.
- Failed proof with outputRef → FAIL.

---

## Law GRASSEYE-TEXT-INPUT-CAPABILITY-008-V2

status: active  
tier: P0  
capabilityDomain: text-input-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: Text Input children are narrow execution bindings and must use unified runtime.

### 主题

六个子能力窄绑定

### 法条

Active child capabilities:

```txt
type-text
paste-text
clear-input
replace-input
press-key
commit-input
```

Required:
- Each child has `contract.ts`, `schema.ts`, and `implementation.ts`.
- Each child delegates to unified Text Input runtime.
- Child implementations must not call primitive ports directly.
- Child implementations must not build final proof/result directly.
- Child implementations must not import BrowserController.
- Child implementations must not import sibling child implementation.
- Child implementations must not expose separate public entrypoints.

Child-specific requirements:
- `type-text`: non-empty approved text required.
- `paste-text`: non-empty approved text + clipboard policy required.
- `clear-input`: clear-only, no approved text required.
- `replace-input`: clear then write under one governed result.
- `press-key`: governed non-commit key enum only; Enter blocked unless policy explicitly routes to commit-input.
- `commit-input`: governed commit key enum + approvedCommitRef + policy/human approval when required.

### 禁止

FORBIDDEN:
- send-message child.
- publish child.
- select-recipient child.
- locate-input child.
- read-input child.
- browser-specific child.
- platform-specific child.
- child direct primitive port execution.
- child returns boolean/null.
- compat/legacy/bridge/v2 roots.

Required inspector:
- Child folder/registry/schema parity.
- Child unified runtime call check.
- Forbidden child root scan.
- Child direct primitive call ban.
- Platform/business child ban.

Required negative proof:
- Add send-message child → FAIL.
- Child calls executionPort directly → FAIL.
- press-key accepts arbitrary key string → FAIL.
- commit-input without approvedCommitRef succeeds → FAIL.
- replace-input skips clear → FAIL.

---

## Law GRASSEYE-TEXT-INPUT-CAPABILITY-009-V2

status: active  
tier: P0  
capabilityDomain: text-input-capability  
enforcementMode: machine-blocking  
evidenceMode: law+inspector+negative-proof

summary: Text Input enforcement must close through owner-local AST/symbol/import-graph inspector, runner, and negative proof.

### 主题

Text Input 执法唯一入口

### 法条

Text Input enforcement must close through:

```txt
scripts/audit/domains/text-input-capability/manifest.json
scripts/audit/domains/text-input-capability/inspector.ts
scripts/audit/domains/text-input-capability/run-inspector.ts
scripts/audit/domains/text-input-capability/negative-proof-harness.ts
```

Required:
- Inspector must use ts-morph AST-level checks.
- Inspector must use symbol and import-graph checks.
- Inspector must use schema-level checks.
- Inspector must include anti-escape checks.
- Inspector must verify active law coverage in registry/matrix/audit-plan/runner.
- Negative proof must run and report fail → rollback → pass.
- CI-FULL must be green for delivery.
- No grep/regex/includes as final judgment.
- No warning-only P0.
- No detached inspector.
- No empty/missing negative proof.
- No generated fake PASS.
- No capability-check.ts.
- No verify script as release truth.

Required inspector checks:
```txt
1. Law file is machine-blocking.
2. Public contract is write-only and port-based.
3. Input schema includes full chain fields.
4. Approved text/hash/ref policy enforced.
5. Target/focus proof required.
6. Clipboard policy and no-plaintext persistence enforced.
7. Sensitive text redaction and approval enforced.
8. Commit/press-key policy enforced.
9. Primitive execution only through TextInputExecutionPort.
10. AbortSignal/timeout enforced.
11. No retry/fallback/no-op success.
12. Success requires PAV handoff.
13. Result/proof/input parity.
14. Children use unified runtime.
15. No raw text/clipboard/API key leakage.
16. No forbidden imports/symbols/business fields.
17. ALL active Text Input laws in registry/matrix/audit-plan/runner.
18. negative-proof-harness executed.
```

Required negative proof:
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
add retry loop
success without postActionVerificationHandoffRef
add sendSuccess/pageStateVerified to result
child calls primitive port directly
child imports BrowserController
add send-message child
capability-check.ts added
remove negative proof invocation
turn P0 into warning-only
```

---

## Final Readiness Gate

Text Input is READY only when:

```txt
law/blueprint/inspector/generated/runner agree
all active Text Input laws are machine-blocking
full chain fields required in input/result/proof
approved text/hash/ref enforced for non-empty writes
target/focus proof enforced
sensitive text cannot leak raw
clipboard lifecycle is transient and proof-safe
primitive execution only through ports
AbortSignal/timeout enforced
no retry/fallback/no-op success
success requires PAV handoff
result/proof/input parity passes
children are narrow unified runtime bindings
owner-local inspector PASS
negative proof PASS
ALL active law enforcement PASS
CI-FULL PASS
```
