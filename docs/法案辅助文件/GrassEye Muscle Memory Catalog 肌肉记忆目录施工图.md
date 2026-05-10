# GrassEye Muscle Memory Catalog 肌肉记忆目录施工图

本施工图替代 retired package chain / retired template flow / retired deterministic flow planning / retired branch-token field 生产主权。
凡旧施工图与本文件冲突，以本文件为准。

## 文件身份

本施工图定义旧流程包退场后的动作编号主权。

Owner boundary: capability-group-governance
Runtime consumers: ai-capability, orchestration-capability

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
