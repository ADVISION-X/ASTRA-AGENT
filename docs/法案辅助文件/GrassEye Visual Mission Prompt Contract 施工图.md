# GrassEye Visual Mission Prompt Contract 施工图

本施工图替代 retired package chain / retired template flow / retired deterministic flow planning / retired branch-token field 生产主权。
凡旧施工图与本文件冲突，以本文件为准。

## 文件身份

本施工图定义旧流程包退场后的 Visual Mission Prompt Contract。

Prompt owner: ai-capability
Runtime consumers: commander-console-capability, orchestration-capability
Retired systems: retired package chain, retired template flow, retired deterministic flow planning, retired branch-token field

## Retired Vocabulary Table

| 抽象词 | 代表性禁止口径 |
| --- | --- |
| retired branch-token field | retired AI branch token |
| legacy route-plan field | retired route identifier |
| retired selection field | retired binding selection identifier |
| retired binding field | retired binding snapshot identifier |
| retired package chain | retired package-governance chain |
| retired template flow | retired template entry flow |

## 主权链

APP Start Page
-> userRequirementText
-> selectedPlatforms
-> PlatformRegistry
-> MuscleMemoryCatalog
-> screenshot original + coordinate grid
-> Visual Mission Prompt Builder
-> Visual Mission Judge
-> governed decision + actions[].actionCode action-plan tokens
-> ActionPlan Decoder
-> Scheduler

## 五段式 Prompt

第一段：Round Mission Packet
- mission.userRequirementText
- mission.requestedPlatformId
- mission.selectedPlatforms
- round.roundId / round.roundIndex / round.currentPhase
- progress / lastAction / currentEvidence 摘要

第二段：Current Visual Evidence
- originalScreenshotRef
- coordinateGridScreenshotRef
- gridSpecRef
- visualMissionInputRef
- pageStateRef

第三段：Platform Registry
- PlatformRegistry profile
- governed platformContextRef + platformContext

第四段：System Manual
- MuscleMemoryCatalog single action codes
- MuscleMemoryCatalog composite action codes
- allowed action input policy
- STOP_REVIEW_REQUIRED fail-closed 语义

第五段：Output Format
- schemaVersion=visualMissionActionPlan.v1
- userIntentUnderstanding
- platform
- isTargetPlatform
- surface
- isTargetFeed
- pageStateDecision
- productDecision
- confidence
- visualEvidence
- actions[].actionCode
- actions[].required
- actions[].reason
- actions[].input
- riskFlags
- nonExecutableSummary

## Stateless Continuity

- AI 在每轮都必须被视为 stateless across rounds。
- Round Mission Packet 是唯一连续性来源，不得假设 previous AI calls 记忆仍然有效。
- Current Visual Evidence 必须重新评估，不得把上一轮截图理解当成当前轮真相。
- AI 不得向人类索要普通下一步动作、审批、拒绝、恢复点击或浏览决策。

## 输出硬规则

AI 只能输出 MuscleMemoryCatalog 中存在的 actionCode。
`actions[].actionCode` 是 governed planning token，不是 execution authority。
AI 允许输出：
- `actions[].actionCode`
- `actions[].required`
- `actions[].reason`
- `actions[].input.gridCell` only when the selected actionCode requires a grid cell
- `actions[].input.key` only when the selected actionCode is a governed key action declared in MuscleMemoryCatalog

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
- raw browser command
- DOM / BOM operation
- arbitrary URL to open
- Nerve Bus envelope
- Forensics write request

未知 actionCode = fatal。
组合 actionCode 只能由系统展开，AI 不得展开为自由动作文本。

Review semantics:
- `review_required` 是受治理结果状态，不是自动继续路线。
- `STOP_REVIEW_REQUIRED` 是合法 actionCode，用于要求系统停止本轮并转入 Commander Console 人工处理入口。

## ActionPlan 示例

```json
{
  "schemaVersion": "visualMissionActionPlan.v1",
  "userIntentUnderstanding": { "matched": true, "summary": "继续在当前平台判断是否为产品视频并决定下一步受治理动作" },
  "platform": "facebook-web",
  "isTargetPlatform": true,
  "surface": "reels_video",
  "isTargetFeed": true,
  "pageStateDecision": "ready",
  "isProductVideo": true,
  "productDecision": "product_yes",
  "confidence": 0.88,
  "visibleProductTypes": ["shirt"],
  "visualEvidence": ["当前画面主体是服饰产品视频，点赞按钮可见。"],
  "actions": [
    {
      "actionCode": "SAVE_LEAD",
      "required": true,
      "reason": "当前画面满足产品线索保存条件。",
      "input": {}
    },
    {
      "actionCode": "LIKE_CURRENT_VIDEO",
      "required": false,
      "reason": "点赞作为次要受治理动作。",
      "input": { "gridCell": "D42" }
    },
    {
      "actionCode": "NEXT_VIDEO",
      "required": true,
      "reason": "完成当前轮后进入下一条视频。",
      "input": {}
    }
  ],
  "nonExecutableClickTargets": [
    {
      "gridCell": "B48",
      "targetName": "close_popup"
    }
  ],
  "riskFlags": [],
  "reason": "Current screen matches the requested product-discovery flow.",
  "nonExecutableSummary": "当前轮可继续执行 SAVE_LEAD 与后续滚动。"
}
```
