# GrassEye Open 能力组施工图

## 文件身份

- owner: open-capability
- 目标：Open 只打开目标并回传 raw open observation handoff，不承担页面语义

## 能力边界

Open 负责：

```txt
接收 targetProfileRef 或 governed targetUrl
校验目标来源与 URL 安全
使用真实 Chrome 打开目标（open-platform-entry-once）
或打开 local workbench（open-local-workbench-once）
返回 openResultRef
返回 navigationAttemptProofRef
返回 rawBrowserObservationRef / postOpenObservationRef
```

Open 不负责：

```txt
page readiness
page correctness
semantic success
登录/captcha/feed/safety 判断
AI 判断
截图
点击
Forensics 写入
local arbitrary program launcher
动作计划
业务流程
```

## 当前 Active Child 能力

```txt
open-platform-entry-once   — 使用真实 Chrome 打开平台入口
open-local-workbench-once  — 打开本地 workbench
```

平台是数据，不是 child：

```txt
platform is data: targetProfileRef = facebook / tiktok / ...
platform is not child capability.
```

## 输入最小字段

```txt
missionId
runId
roundId when applicable
stepId
capabilityCallId
nerveBusEnvelopeId
targetProfileRef or targetUrl (targetUrlSource = user | platformRegistry | system)
inputRef
idempotencyKey
timeoutMs when applicable
```

禁止字段：

```txt
能力组内部字段
调度计划字段
多动作计划字段
pageReady / pageCorrect / feedReady / semanticSuccess
pageStateHandoffRef / pageStateRef
```

## 输出原则

- Open success 返回 openResultRef + rawBrowserObservationRef / postOpenObservationRef
- AI 仍是页面语义与 readiness 唯一真相源
- targetUrl 必须来自当前输入或 PlatformRegistry
- rawBrowserObservationRef 只包含：currentUrl / currentTitle / browserSessionRef / navigationStartedAt / navigationEndedAt / rawRuntimeSignals

禁止在 rawBrowserObservationRef 中包含：

```txt
pageReady / pageCorrect / feedReady / loginSemantic / captchaSemantic
safetySemantic / feedSemantic / videoSemantic / commentSemantic
businessTruth / semanticSuccess
```

## Proof 字段

Open proof 只证明导航尝试发生或失败：

```txt
proofId
abilityGroupId = open
childCapabilityId
missionId / runId / roundId / stepId / capabilityCallId
nerveBusEnvelopeId / requestedBy
targetProfileRef? / targetUrlSource? / targetUrlHash?
status
openResultRef?
rawBrowserObservationRef? / postOpenObservationRef?
failureReason? / reviewRequiredReason?
startedAt / endedAt / durationMs
```

## 漂移信号

```txt
Open success 直接声称 pageReady / pageCorrect
Open 依赖 pageStateHandoffRef
Open 执行点击、输入、滚动、截图
```
