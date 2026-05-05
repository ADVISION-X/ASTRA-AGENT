# Law / Blueprint Mapping

## Current Blockers

| Blocker | Owner boundary | Law file / lawId | Blueprint file / section | Mapping |
|---|---|---|---|---|
| BLOCKER-RUNTIME-1 | local runtime screenshot dispatch feeding Screenshot input | `module-screenshot-capability.instructions.md` / `GRASSEYE-SCREENSHOT-CAPABILITY-003-V2`; `GRASSEYE-SCREENSHOT-CAPABILITY-005-V2` | `docs/法案辅助文件/GrassEye Screenshot 能力组施工图.md` / `5. Input Model`; source-proof section for stored-image / prepare-ai-input | Screenshot input must carry full chain fields, `source`, source proof, capture policy, and timeout, and runtime must fail closed on source violations. The blueprint also marks `source` as required and requires transformed paths like `prepare-ai-input` to carry stored-image lineage. Current runtime violates this before Screenshot execution can produce a valid `prepare-ai-input` request because the adapter omits `source` entirely. |
| BLOCKER-RUNTIME-2 | local runtime Open composition | `module-open-capability.instructions.md` / `GRASSEYE-OPEN-CAPABILITY-004-V2`; `GRASSEYE-OPEN-CAPABILITY-009-V1` | `docs/法案辅助文件/GrassEye Open 能力组施工图.md` / Open local-program branch; local-program port and handoff sections | Open must run a fixed target / profile / session / navigation / idempotency / timeout / page-state-handoff pipeline, and local program launch must be first-class through `OpenLocalProgramPort`. Current runtime composes the Open ability group without a `localProgram` port, so the governed local-program path fails immediately with `OpenLocalProgramPort is not configured`. |
| BLOCKER-RUNTIME-3 | builtin map package transition closure consumed by Orchestration | `module-map-plugin-package.instructions.md` / `GRASSEYE-MAP-PLUGIN-002-V2`; `module-orchestration-capability.instructions.md` / `GRASSEYE-ORCHESTRATION-CAPABILITY-002-V3` | `docs/法案辅助文件/GrassEye 地图插件包治理施工图.md` / `2.2 地图验证到激活`; `3. 标准目录结构` validation list | Map packages must pass transition closure validation before activation, and Orchestration may only consume validated declarative maps. The mirroring builtin maps declare `failureBranch` / `reviewBranch` on `open-iphone-mirroring` but ship without matching transitions, so the runtime map consumed by Orchestration violates the declared closure contract. |

## Supporting Governance Gaps

| Gap | Owner boundary | Law file / lawId | Mapping |
|---|---|---|---|
| PREFLIGHT-GAP-1 | Commander mission preflight | `module-commander-console-capability.instructions.md` / `GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2` | Commander command dispatch must be explicit, platform-safe, and semantically validated before dispatch. Current mission preflight checks map binding, command contract, schema, browser, local AI, and data store, but it does not validate mirroring-specific local-program runtime readiness, so it incorrectly returns passed before the Open step fails. |
| ENFORCEMENT-GAP-1 | screenshot / map / commander inspectors | `module-screenshot-capability.instructions.md` / `GRASSEYE-SCREENSHOT-CAPABILITY-008-V2`; `module-map-plugin-package.instructions.md` / enforcement law; `module-commander-console-capability.instructions.md` / `GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-008-V2` | Each owner domain claims machine-blocking enforcement through owner-local inspector plus negative proof, but the current checks leave concrete blind spots: missing `prepare-ai-input` source mapping, missing local-program runtime dependency validation, and missing step-level transition closure validation. |

## Fresh Elimination Of Wrong Owners

- Startup is not the current owner.
  - Latest startup run passed through app shell, local AI, map readiness, and mission runtime availability.
- Nerve Bus acceptance is not the current owner.
  - `COMMAND_ACCEPTED` exists on all four mission families.
- Page State is not the current owner.
  - web missions pass `detect-login-state`, `detect-safety-page`, and `detect-feed-ready` before failing.
- Historical screenshot `videoVisitId` parity is not the current owner.
  - It appears only in earlier mixed evidence, not in the latest 17:10 terminal run.
