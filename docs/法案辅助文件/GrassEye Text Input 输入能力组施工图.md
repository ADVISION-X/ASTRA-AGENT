# GrassEye Text Input 输入能力组施工图

## 文件身份

- owner: text-input-capability
- 目标：Text Input 只写入批准文本或按键，不承担文本生成和语义真相

## 能力边界

Text Input 负责：

```txt
type / paste / clear / replace / press-key
消费 approvedText / approvedKey
返回 primitive write proof
```

Text Input 不负责：

```txt
生成文本
发现目标
页面语义判断
retired selection / retired chain truth
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
targetRef
approvedText or approvedKey
writeMode
idempotencyKey
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
```

## 输出原则

- proof 只证明 primitive write 已执行
- semantic success 由下一轮 AI 判断
- 不得在 proof 里输出 pageReady / pageCorrect / action verified

## 漂移信号

```txt
Text Input 自己生成文本
proof 携带 retired binding field
retired branch-token field 成为 text-input truth
```
