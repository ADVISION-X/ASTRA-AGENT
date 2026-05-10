# GrassEye 第五阶段高级AI视觉任务与WEB本地程序打通施工图

status: active / current delivery authority under phase-five final-delivery debugging.

## 1. 施工边界

本施工图只补第五阶段建设细节，不新增 lawId，不修改冻结法案。第五阶段不再以 retired package chain / retired binding state / retired selection choice 为生产真相，而以 visual mission context、Prompt Contract Registry、MuscleMemoryCatalog、PlatformRegistry 与 AI action plan 为主链。

## 2. Phase-05 主链

```txt
userRequirementText + selectedPlatforms
→ Visual Mission Prompt Contract
→ AI Visual Mission Judge
→ actions[].actionCode
→ Scheduler / owning capability groups
→ Forensics record
```

## 3. Phase-05 debug truth

AI debug、runtime debug、transport debug、Forensics debug 必须保留：

```txt
missionId
runId
roundId when applicable
stepId
capabilityCallId
promptContractId
outputSchemaRef
actionCodes when applicable
failureReason when applicable
```

禁止：

```txt
retired package-chain ids
legacy activation binding
retired branch tokens
legacy retired deterministic flow identifiers
```

## 4. 执法要求

- AST/symbol/import graph 检查生产路径。
- real-code-inspection 覆盖生产突变和 inspector wiring 突变。
- structured debug truth 必须进入受治理 sink。
- business map 旧口径不得回流到 production runtime。
