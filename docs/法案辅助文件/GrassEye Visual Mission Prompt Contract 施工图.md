# GrassEye Visual Mission Prompt Contract 施工图

本施工图替代 retired package chain / retired template flow / retired deterministic flow planning / retired branch-token field 生产主权。
凡旧施工图与本文件冲突，以本文件为准。

## 文件身份

本施工图定义旧流程包退场后的 Visual Mission Prompt Contract。

Prompt owner: ai-capability
Runtime consumers: commander-console-capability, orchestration-capability
Retired systems: retired package chain, retired template flow, retired deterministic flow planning, retired branch-token field

## Retired Vocabulary Table

| 抽象词 | 实际禁止字段 |
| --- | --- |
| retired branch-token field | routeLabel |
| legacy route-plan field | routePlanId |
| retired selection field | selectedMapId / selectedMapVersion |
| retired binding field | activationId / activationSnapshotRef |
| retired package chain | mapPackageId / mapPackageVersion / map-plugin-package |
| retired template flow | taskTemplateId / taskTemplate |

## 主权链

APP Start Page
-> userRequirementText
-> selectedPlatforms
-> PlatformRegistry
-> MuscleMemoryCatalog
-> Visual Mission Prompt Builder
-> Visual Mission Judge
-> ActionPlan Decoder
-> Scheduler

## 三段式 Prompt

第一段：用户需求
- userRequirementText
- selectedPlatforms
- optional historyEntryId
- maxRounds
- maxMinutes

第二段：系统手册
- PlatformRegistry profile
- MuscleMemoryCatalog single action codes
- MuscleMemoryCatalog composite action codes
- allowed action input policy

第三段：输出格式
- schemaVersion=visualMissionJudge.v1
- decision
- platform
- screenState
- confidence
- actions[].actionCode
- actions[].required
- actions[].input
- riskFlags
- reason

## 输出硬规则

AI 只能输出 MuscleMemoryCatalog 中存在的 actionCode。

AI 禁止输出：
- retired branch-token field
- legacy route-plan field
- legacy template field
- retired selection field
- abilityGroupId
- childCapabilityId
- nextIntent
- suggestedNextAction
- raw x/y
- free-form browser instruction

未知 actionCode = fatal。
组合 actionCode 只能由系统展开，AI 不得展开为自由动作文本。

## ActionPlan 示例

```json
{
  "schemaVersion": "visualMissionJudge.v1",
  "decision": "continue",
  "platform": "facebook-web",
  "screenState": "feed_ready",
  "confidence": 0.88,
  "actions": [
    {
      "actionCode": "SAVE_LEAD",
      "required": true,
      "input": {}
    },
    {
      "actionCode": "LIKE_CURRENT_VIDEO",
      "required": false,
      "input": {}
    },
    {
      "actionCode": "NEXT_VIDEO",
      "required": true,
      "input": {}
    }
  ],
  "riskFlags": [],
  "reason": "Current screen matches the requested product-discovery flow."
}
```
