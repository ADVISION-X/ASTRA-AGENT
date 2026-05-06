# Law / Blueprint Mapping

## Current Blockers

| Blocker | Owner boundary | Governing law / contract | Blueprint / construction anchor | Mapping |
|---|---|---|---|---|
| BLOCKER-RUNTIME-1 | Screenshot runtime proof / result truth | `module-screenshot-capability.instructions.md` -> `GRASSEYE-SCREENSHOT-CAPABILITY-004-V2`, `GRASSEYE-SCREENSHOT-CAPABILITY-006-V2`, `GRASSEYE-SCREENSHOT-CAPABILITY-007-V2` | `docs/法案辅助文件/GrassEye Screenshot 能力组施工图.md` -> transformed output rules, `prepare-ai-input success 必须有 scaleMapping`, `diagnosticPayloadRef: required-if-not-success`, section `24. 实战运行日志透明化修复补充：prepare-ai-input handoff` | Screenshot owns transformed screenshot truth, AI-input preparation truth, and scale-mapping truth. The blueprint explicitly separates success requirements from non-success diagnostics. The current runtime violates that contract by rejecting failed `prepare-ai-input` proofs for lacking a success-only field, which makes the live stop point a Screenshot proof-governance defect. |
| BLOCKER-LOG-1 | Commander command-ingress logging and accepted-command proof chain | `module-commander-console-capability.instructions.md` -> `GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V2`; `module-structured-logging.instructions.md` general DEBUG-field requirements; historical corroboration: `GRASSEYE-STRUCTURED-LOGGING-007-V1` exact ingress-event chain | `docs/法案辅助文件/GrassEye Commander Console 总司令控制台能力组施工图.md` -> `18.1 start-mission runId 传输契约补充`, `结构化日志必备字段`, accepted receipt / `COMMAND_ACCEPTED` required-field list | Commander result / proof must preserve the governed command chain, and accepted-command runtime truth must carry mission correlation fields instead of null placeholders. The blueprint also requires `COMMAND_ACCEPTED` to expose `traceId`, `runId`, `missionId`, `selectedMapId`, `requestedPlatformId`, and `activationSnapshotRef`, while the structured logging contract requires the full user-command ingress path. The latest real bundle violates that transparency contract because draft / received events are missing and some accepted-command surfaces still carry null mission correlation fields. |

## Historical / Non-Current Mapping

| Historical item | Why it is not current |
|---|---|
| older Screenshot `source Required` blocker | the latest authoritative run advanced beyond source handoff and failed later on `scaleMapping` proof validation |
| earlier mirroring open / map-closure blockers | not exercised by the authoritative `tiktok-web` rerun in this verification bundle |

## Governance Judgment

- The current P0 does not require new law text; the governing Screenshot law and blueprint are already explicit enough.
- The current P1 also does not require new law text; the Commander / structured-logging contract already requires stronger ingress transparency than the latest real bundle delivers.
- Both current blockers are therefore implementation / enforcement failures against existing governance, not blueprint gaps.
