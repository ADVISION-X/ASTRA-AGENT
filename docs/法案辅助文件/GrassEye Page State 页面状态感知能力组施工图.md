# GrassEye Page State 退役说明 / Raw Browser Observation Helper 边界

## 退役裁决

**Page State 独立能力组已退出当前主线。**

```txt
Page State independent ability group should exit the main stage.
```

- 不再拥有 `src/capabilities/page-state`
- 不再拥有 `scripts/audit/domains/page-state-capability`
- 不再是 CI-FULL active owner

## 替代方案

currentUrl / currentTitle / browserLoginState / rawRuntimeSignals 只能通过以下极简 helper 提供：

```txt
src/lib/browser/browser-observation.ts
```

函数：

```ts
readRawBrowserObservation(input, source): RawBrowserObservation
```

它只提供：

```txt
observationRef
currentUrl?
currentTitle?
browserLoginState?
rawRuntimeSignals?
snapshotProofRef?
observedAt
status
failureReason?
```

## Helper 边界

它不得：

```txt
1. 作为 ability group 注册。
2. 作为 MuscleMemory 能力登记。
3. 作为 AI 可见 actionCode。
4. 作为 Orchestration 决策源。
5. 作为 PAV 输入真相。
6. 作为 Commander dashboard source。
7. 作为 Forensics business record source。
```

## 禁止字段（永久）

```txt
feedReady
pageReady
pageCorrect
pageStateType = platform_feed
loginSemantic
captchaSemantic
safetySemantic
feedSemantic
videoSemantic
commentSemantic
blockerDecision
actionSemanticSuccess
semanticDecision
businessTruth
retired selection / retired chain truth
action semantic success
```

## 语义真相归属

AI Visual Mission Judge + 当前截图 + 坐标图 + 能力登记册 是唯一语义判断源。

Page State helper 只提供 raw string 备注，不做任何判断。

## 退役守卫

`scripts/audit/domains/retired-surface-guard/inspector.ts` 负责阻断回归。


## 输入最小字段

```txt
missionId
runId
roundId when applicable
stepId
capabilityCallId
nerveBusEnvelopeId
inputRef
openHandoffRef when applicable
currentUrl when available
currentTitle when available
browserLoginState when available
rawRuntimeSignals
snapshotProof
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
feedReady
pageReady
pageCorrect
```

## 输出原则

- 输出只能是 raw observation package
- AI 是页面语义唯一真相源
- PAV / Orchestration / Forensics 只可消费 raw observation refs
- Final semantic truth belongs to AI Visual Mission Judge

## 漂移信号

```txt
Page State 输出 semantic decision
proof 携带 retired binding field
pageStateType = platform_feed
```
