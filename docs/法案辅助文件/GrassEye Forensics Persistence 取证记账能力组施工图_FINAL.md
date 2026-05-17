# GrassEye Forensics Persistence 取证记账能力组施工图 FINAL

## 文件身份

- owner: forensics-persistence-capability
- 目标：Forensics 只做 append-only 记账，不恢复旧地图链字段

## 主链位置

```txt
AI result / action result / observation result
→ record envelope
→ append-only persistence
→ record refs / artifact refs
```

## 记录最小链路

```txt
missionId
runId
sessionId when applicable
roundId when applicable
stepId when applicable
capabilityCallId when applicable
promptContractId when AI record exists
actionPlanRef or actionCodes when action record exists
decisionRef when AI decision record exists
artifactRefs when evidence exists
parentRefs when linking records
```

## Product Lead Record 最小字段

```txt
platformId
targetUrl when available
targetTitle when available
screenshotEvidenceRef
aiResultRef
decision
actionCodes
confidence
reason
createdAt
missionId
runId
```

禁止字段：

```txt
retired package field
retired package version field
retired selection field
retired selection version field
retired binding field
运行计划字段
retired branch-token field
```

## 输出原则

- Forensics 保存 AI 输出 refs、action refs、observation refs、artifact refs
- Forensics 不重建业务真相
- proof 只保留 durability truth + short-chain mission refs

## 漂移信号

```txt
product_lead_record 继续要求 retired branch-token field
record proof 携带 retired binding field
Forensics 反向推理 mission flow
```
