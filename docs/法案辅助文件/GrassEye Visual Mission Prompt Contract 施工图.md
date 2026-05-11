# GrassEye Visual Mission Prompt Contract 施工图

```yaml
owner: ai-capability
notAbilityGroup: true
narrativeRole: prompt-contract-governance
retiredMapFreeIdentity: true
```

本施工图定义 Visual Mission Prompt Contract 的最终方向。
AI prompt receives capability registry, not package-flow library.
任何历史 package、workflow、semantic shortcut、composite 口径，如仍存在，只能视为过渡差异。

## 文件身份

- Prompt owner: ai-capability
- Runtime consumers: commander-console-capability, orchestration-capability
- Final role: feed AI with user requirement, current evidence, platform facts, and capability registry

## 主权链

APP Start Page
-> userRequirementText
-> selectedPlatforms
-> PlatformRegistry
-> MuscleMemoryCatalog as capability registry
-> screenshot original + coordinate grid
-> Visual Mission Prompt Builder
-> Visual Mission Judge
-> governed decision + registered capability sequence
-> Orchestration decode / validate / dispatch

当前代码若仍使用 `actions[].actionCode`，该字段只可作为 capability registry entry id 的 transport 序列化字段。

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

第四段：Ability Manual
- capability groups
- AI-visible atomic child capabilities
- allowed action input policy
- no raw coordinate rule
- Geometry Guard handoff rule
- STOP_REVIEW_REQUIRED fail-closed 语义

第五段：Output Format
- schemaVersion=visualMissionActionPlan.v1 or future registry-equivalent schema
- userIntentUnderstanding
- platform
- isTargetPlatform
- surface
- pageStateDecision
- productDecision
- confidence
- visualEvidence
- actions[] as registered capability sequence
- riskFlags
- nonExecutableSummary

## Ability Manual 规则

- AI prompt receives capability registry, not package-flow library.
- AI is allowed to compose registered atomic abilities.
- AI must not assume prebuilt business flows are the main path.
- AI must not invent ability names.
- AI must not output raw coordinate.
- 当前 transport 若使用 `actions[].actionCode`，该字段只能表示已登记的原子能力条目 id。

## Stateless Continuity

- AI 在每轮都必须被视为 stateless across rounds。
- Round Mission Packet 是唯一连续性来源，不得假设 previous AI calls 记忆仍然有效。
- Current Visual Evidence 必须重新评估，不得把上一轮截图理解当成当前轮真相。
- AI 不得向人类索要普通下一步动作、审批、拒绝、恢复点击或浏览决策。

## 输出硬规则

AI 只能输出登记册中存在的能力条目。
`actions[].actionCode` 若存在，只是 governed planning token，不是 execution authority。

AI 允许输出：
- `actions[].actionCode` 作为已登记原子能力条目 id
- `actions[].required`
- `actions[].reason`
- `actions[].input.gridCell` only when the selected registry entry requires a grid cell
- `actions[].input.key` only when the selected registry entry requires a governed key

AI 禁止输出：
- retired branch-token field
- legacy route-plan field
- legacy template field
- retired selection field
- abilityGroupId as owner-internal dispatch shortcut
- childCapabilityId as owner-internal dispatch shortcut
- nextIntent
- suggestedNextAction
- raw x/y
- free-form browser instruction
- raw browser command
- DOM / BOM operation
- arbitrary URL to open
- Nerve Bus envelope
- Forensics write request

未知或未登记能力 = fatal。
semantic action、package、workflow、composite 若仍存在于代码，只能被视为 historical transition only。

Review semantics:
- `review_required` 是受治理结果状态，不是自动继续路线。
- `STOP_REVIEW_REQUIRED_ONCE` 或等价的登记停止条目，用于要求系统停止本轮并转入 Commander Console 人工处理入口。

## 正反例

正例：
- CAPTURE_VIEWPORT_ONCE
- SAVE_EVIDENCE_RECORD_ONCE
- LEFT_CLICK_GRID_CELL_ONCE
- PRESS_KEY_ONCE
- STOP_REVIEW_REQUIRED_ONCE

反例：
- LIKE_CURRENT_VIDEO
- OPEN_COMMENTS
- NEXT_VIDEO
- SAVE_PRODUCT_AND_LIKE
- YES_SEEDING_VIDEO_FLOW
- NO_SEEDING_VIDEO_FLOW

## Action Plan 示例

```json
{
  "schemaVersion": "visualMissionActionPlan.v1",
  "userIntentUnderstanding": {
    "matched": true,
    "summary": "继续在当前平台判断是否为产品视频，并组合已登记原子能力。"
  },
  "platform": "facebook-web",
  "isTargetPlatform": true,
  "surface": "reels_video",
  "pageStateDecision": "ready",
  "productDecision": "product_yes",
  "confidence": 0.88,
  "visualEvidence": [
    "当前画面主体是服饰产品视频，点赞按钮与评论按钮均可见。"
  ],
  "actions": [
    {
      "actionCode": "CAPTURE_VIEWPORT_ONCE",
      "required": true,
      "reason": "先记录当前视口证据。",
      "input": {}
    },
    {
      "actionCode": "SAVE_EVIDENCE_RECORD_ONCE",
      "required": true,
      "reason": "保存当前产品证据记录。",
      "input": {}
    },
    {
      "actionCode": "LEFT_CLICK_GRID_CELL_ONCE",
      "required": false,
      "reason": "点击点赞按钮。",
      "input": { "gridCell": "D42" }
    },
    {
      "actionCode": "LEFT_CLICK_GRID_CELL_ONCE",
      "required": false,
      "reason": "点击评论按钮。",
      "input": { "gridCell": "E44" }
    }
  ],
  "riskFlags": [],
  "nonExecutableSummary": "当前轮可继续执行登记册中的原子能力。"
}
```

## Prompt 模板质量强制规范（施工图细节，防止复发）

### 枚举值示例必须使用具体值
- **禁止**在 Output Schema 示例中使用管道符分隔的枚举选项，例如：`"ready|recover|review_required|blocked"`
  - 小模型（如 qwen2.5vl:3b）会将管道符分隔的值逐字复制到输出中，导致 Zod 枚举验证失败
- **必须**使用单一具体的枚举值作为示例：`"pageStateDecision": "ready"`, `"productDecision": "product_yes"`
- 枚举选项说明应在 System Prompt 文字描述中体现，不在 JSON 示例中使用管道符

### 示例字符串字段必须使用真实内容
- **禁止**使用描述性占位符，例如：`"surface": "string — e.g. reels feed"`
  - 小模型会将占位符原文复制为输出，导致字段含义丢失
- **必须**使用实际内容示例：`"surface": "reels feed"`

### 视觉输入：仅发送坐标格图片到模型
- AI 推理调用只发送**坐标格截图（coordinate grid screenshot）**作为物理图片字节
- 原始截图（original screenshot）仅以 ID 引用（ref）形式出现在 Prompt 文本中，不发送图片字节
- 理由：坐标格截图已包含原始视口的全部视觉内容（原始截图 + 格子叠加）。同时发送两张大图会导致 qwen2.5vl:3b 视觉上下文超载，输出破损 JSON（如 `{ "type=":0`，无闭合括号），`extractFirstJsonObject` 抛出"no JSON object"错误
- 质检：VMF-28 检查 mission-loop-runner 只为 inputRef 中的坐标格截图提供 filePath

### 执法脚本卡点（VMF-27, VMF-28）
- VMF-27：检查 AI prompt 示例中不含管道符枚举值和字符串描述符占位符
- VMF-28：检查 mission-loop-runner 只发送坐标格图片给模型（原始截图无 filePath）

