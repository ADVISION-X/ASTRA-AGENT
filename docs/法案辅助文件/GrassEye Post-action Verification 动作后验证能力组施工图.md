# GrassEye Post-action Verification 动作后验证能力组施工图

## 文件身份

- owner: post-action-verification-capability
- 目标：PAV 固定为 bounded observation packaging，不再充当统一生产 gate

## 能力边界

PAV 负责：

```txt
before/after evidence binding
observation refs packaging
postActionVerificationResultRef
observationFingerprint
```

PAV 不负责：

```txt
final semantic action truth
page semantics
retired selection / retired chain truth
所有动作后必经 gate
```

## 输入最小字段

```txt
missionId
runId
roundId when applicable
stepId
capabilityCallId
nerveBusEnvelopeId
sourceActionResultRef
sourceActionRuntimeProofRef
beforeEvidenceRefs
afterEvidenceRefs
observationRefs
verificationPolicy
```

禁止字段：

```txt
retired package field
retired package version field
retired selection field
retired selection version field
retired binding field
legacy route-plan field
retired branch-token field
verificationDecision
finalActionTruth
businessTruth
```

## 输出原则

- 只输出 observation package truth
- semantic success 仍属于下一轮 AI
- PAV 只能按 policy 启用，不再是所有动作后的必经步骤
- Final semantic truth belongs to AI Visual Mission Judge, not PAV

## 漂移信号

```txt
universal mandatory PAV after every real action
PAV 输出 final semantic truth
proof 携带 retired binding field
```
