# Law / Blueprint Mapping

## BLOCKER-1: Commander start-mission timeout after acceptance

| Layer | Evidence |
|---|---|
| Law file | `.github/instructions/cursor-rules/modules/module-commander-console-capability.instructions.md` |
| lawId | `GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2`; also touches `006/007` proof/result semantics |
| Law requirement | Command envelope must be explicit, timeout-governed, idempotent, and semantically validated. Timeout results must be typed and governed. |
| Law violation | Timeout is real, but it is scoped to the whole long-running mission loop. This allows `COMMAND_ACCEPTED` and `COMMAND_REJECTED` for the same start command. |
| Blueprint file | `docs/法案辅助文件/GrassEye Commander Console 总司令控制台能力组施工图.md` |
| Blueprint section | timeout gate; local app shell `COMMAND_ACCEPTED / COMMAND_REJECTED` refs |
| Blueprint requirement | timeout produces typed failed/review result; local shell rejected path includes owner/actionable/proof refs. |
| Blueprint gap | It does not clearly state that start-mission command acceptance must return before mission terminal execution. |
| Fix layer | Production + blueprint + commander inspector + negative proof + structured log semantics |

## BLOCKER-2: `detect-safety-page` normal page lacks supporting negative observations

| Layer | Evidence |
|---|---|
| Law file | `.github/instructions/cursor-rules/modules/module-page-state-capability.instructions.md` |
| lawId | `GRASSEYE-PAGE-STATE-CAPABILITY-004-V2`, `GRASSEYE-PAGE-STATE-CAPABILITY-005-V2` |
| Law requirement | Observations must be source-bound/fresh; observation-required child success must retain observationRefs; success must not retain critical data-quality flags. |
| Law violation | Normal page branch ignores source-bound negative safety observations, leading to empty observation refs and `insufficient_signal`. |
| Blueprint file | `docs/法案辅助文件/GrassEye Page State 页面状态感知能力组施工图.md` |
| Blueprint section | 7 Observation; 9 Child Capabilities; 12 Output Boundary |
| Blueprint requirement | `detect-safety-page` must judge safety/captcha from `page_marker / platform_capture`; success cannot miss observationRefs. |
| Blueprint gap | It does not explicitly spell out that `page_normal` can be proven by negative `captcha=false` and `safety_wall=false` observations. |
| Fix layer | Production child implementation + blueprint clarification + Page State inspector + negative proof |

## BLOCKER-3: Missing explicit capability-start and mission-finalized taxonomy

| Layer | Evidence |
|---|---|
| Law file | `.github/instructions/cursor-rules/modules/module-structured-logging.instructions.md` |
| lawId | Structured logging lifecycle law set, exact clause not narrowed in this phase |
| Law requirement | Runtime structured logs must allow lifecycle reconstruction with trace/run/span/refs and owner/actionable fields. |
| Law violation | `CAPABILITY_CALL_STARTED` and review-path `MISSION_FINALIZED` are missing as explicit event names. |
| Blueprint file | `docs/法案辅助文件/GrassEye 结构化日志与运行证明施工图.md` |
| Blueprint section | Runtime event lifecycle |
| Fix layer | Structured log production emitters + inspector + negative proof |

## BLOCKER-4: Page State review logs do not surface diagnostic/proof refs

| Layer | Evidence |
|---|---|
| Law file | `.github/instructions/cursor-rules/modules/module-page-state-capability.instructions.md` |
| lawId | `GRASSEYE-PAGE-STATE-CAPABILITY-005-V2`, `GRASSEYE-PAGE-STATE-CAPABILITY-006-V2` |
| Law requirement | Review/failed result keeps diagnosticPayloadRef and runtimeProof. |
| Law violation | Terminal review event does not surface enough Page State diagnostic/proof refs. |
| Blueprint file | `docs/法案辅助文件/GrassEye Page State 页面状态感知能力组施工图.md` |
| Blueprint section | 10 Output Model; 11 Runtime Proof |
| Fix layer | Orchestration review log mapping + structured logging inspector |
