# GrassEye Page State 页面状态感知能力组施工图

## 文件身份

- owner: page-state-capability
- 目标：Page State 只打包 raw page/runtime observation，不承担页面语义真相

## 能力边界

Page State 负责：

```txt
currentUrl / currentTitle 打包
browserLoginState 打包
raw runtime signals 打包
snapshot proof 绑定
```

Page State 不负责：

```txt
feedReady / pageReady / pageCorrect
login/captcha/safety/feed/video/comment semantic 判断
retired selection / retired chain truth
action semantic success
```

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
