# GrassEye Open 能力组施工图

## 文件身份

- owner: open-capability
- 目标：Open 只打开目标并回传 raw handoff，不承担页面语义

## 能力边界

Open 负责：

```txt
打开 targetProfileRef / targetUrl
记录导航尝试 proof
回传 raw page-state handoff refs
```

Open 不负责：

```txt
page readiness
page correctness
semantic success
retired selection / retired deterministic flow planning / retired binding state 真相
```

## 输入最小字段

```txt
missionId
runId
roundId when applicable
stepId
capabilityCallId
nerveBusEnvelopeId
targetProfileRef or targetUrl
inputRef
idempotencyKey
```

禁止字段：

```txt
retired package field
retired package version field
retired selection field
retired selection version field
retired binding field
retired branch-token field
legacy route-plan field
```

## 输出原则

- Open success 只返回 open result ref + raw page-state handoff ref
- AI 仍是页面语义与 readiness 唯一真相源
- targetUrl 不得走默认 fallback 充当运行真相

## 漂移信号

```txt
Open proof 携带 retired binding field
Open success 直接声称 pageReady / pageCorrect
Open fallback 到默认 URL 作为真相
```
