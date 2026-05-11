# GrassEye Muscle Memory Catalog 肌肉记忆目录施工图

本施工图替代 retired package chain / retired template flow / retired deterministic flow planning / retired branch-token field 生产主权。
凡旧施工图与本文件冲突，以本文件为准。

## 文件身份

本施工图定义旧流程包退场后的动作编号主权。

Owner boundary: capability-group-governance
Runtime consumers: ai-capability, orchestration-capability

## Retired Vocabulary Table

| 抽象词 | 代表性禁止口径 |
| --- | --- |
| retired branch-token field | retired AI branch token |
| legacy route-plan field | retired route identifier |
| retired selection field | retired binding selection identifier |
| retired binding field | retired binding snapshot identifier |
| retired package chain | retired package-governance chain |
| retired template flow | retired template entry flow |

## 目录结构

- single actionCode registry
- composite actionCode registry
- ActionPlanDecoder
- CompositeActionExpander
- MuscleActionScheduler

## 单能力 actionCode

- CAPTURE_SCREEN
- PREPARE_VISUAL_MISSION_INPUT
- SAVE_LEAD
- PRESS_KEY
- CLICK_CELL
- WAIT_SHORT
- REOPEN_ENTRY_PAGE
- STOP_REVIEW_REQUIRED

## 组合 actionCode

- LIKE_CURRENT_VIDEO
- NEXT_VIDEO
- SAVE_PRODUCT_AND_LIKE
- YES_SEEDING_VIDEO_FLOW
- CLOSE_POPUP_AND_WAIT

## 硬规则

AI 只能输出 actionCode。
未知 actionCode = fatal。
组合 actionCode 必须由系统展开。
AI 不得输出 retired branch-token field。
AI 不得输出原始 x/y。
Scheduler 只执行解码后的受治理动作。

Review semantics:
- `STOP_REVIEW_REQUIRED` 是合法停止 actionCode。
- 它表示系统必须停止当前轮、写入 Forensics，并在 Commander Console 暴露 review_required 原因。
- runtime 不得边跑边等待人工后自动继续。

## 强度与执行边界

- 每个 actionCode 都必须绑定到一个受治理的强 child capability，或绑定到只由强 child capability 组成的 composite expansion。
- AI 可直接选择的 actionCode 必须至少绑定到 Level 4 child capability strength。
- CLICK_CELL 必须先被解码成受治理几何输入，并经过 Geometry Guard 批准后，Mouse Click 才能执行。
- Mouse Click 不得自行解析 gridCell 或重算坐标。
- CAPTURE_SCREEN 与 PREPARE_VISUAL_MISSION_INPUT 可以作为系统前置动作保留，不要求在每一轮都向 AI 自由开放。
