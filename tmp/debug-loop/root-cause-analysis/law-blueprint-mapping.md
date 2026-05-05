# Law / Blueprint Mapping

## BLOCKER-1: Screenshot dispatch builder drops required chain fields

| Layer | Reference | Requirement | Current violation |
|---|---|---|---|
| Law | `.github/instructions/cursor-rules/modules/module-screenshot-capability.instructions.md` | `GRASSEYE-SCREENSHOT-CAPABILITY-003-V2`: every `ScreenshotAbilityInput` must carry full chain fields, `inputRef`, `idempotencyKey`, timeout policy | Latest real log shows Screenshot input reaching the gate without `stepId/mapPackageId/mapPackageVersion/selectedMapId/selectedMapVersion/activationSnapshotRef/capabilityCallId/nerveBusEnvelopeId/inputRef` |
| Supporting law | `.github/instructions/cursor-rules/modules/module-orchestration-capability.instructions.md` | `GRASSEYE-ORCHESTRATION-CAPABILITY-004-V3`: every ability input generated from Orchestration must include full dispatch chain | Orchestration envelope has the fields, but local-runtime screenshot adapter fails to preserve them |
| Blueprint | `docs/法案辅助文件/GrassEye Screenshot 能力组施工图.md` | `5. Input Boundary` / `6. Source Proof`: Screenshot input requires the same chain fields and cannot success when they are missing | Production runtime enters Screenshot with those fields undefined |
| Supporting blueprint | `docs/法案辅助文件/GrassEye Orchestration 总指挥能力组施工图.md` | `9. Dispatch Through Nerve Bus`: dispatch payload must contain full chain fields | Dispatch payload exists, but adapter projection into Screenshot input is incomplete |
| Law/blueprint conclusion | No law gap | Governance already states the right behavior | Failure is implementation + enforcement-scope drift, not missing governance |

## BLOCKER-2: CAPABILITY_CALL_STARTED event is missing from runtime lifecycle

| Layer | Reference | Requirement | Current violation |
|---|---|---|---|
| Law | `.github/instructions/cursor-rules/modules/module-structured-logging.instructions.md` | `GRASSEYE-STRUCTURED-LOGGING-003-V1`: structured DEBUG events must make runtime behavior root-causeable without hidden in-memory inference | Current lifecycle exposes dispatch-start and terminal result, but not explicit capability-call start |
| Supporting law | `.github/instructions/cursor-rules/modules/module-orchestration-capability.instructions.md` | `GRASSEYE-ORCHESTRATION-CAPABILITY-004-V3`: dispatch semantics and chain proof must remain explicit through governed work | Operators must infer ability-call start from `STEP_DISPATCH_STARTED` |
| Blueprint | `docs/法案辅助文件/GrassEye Orchestration 总指挥能力组施工图.md` | `9. Dispatch Through Nerve Bus`: dispatch payload/proof must expose governed step execution chain | Runtime lifecycle has no dedicated capability-start event stage |
| Supporting blueprint | `docs/法案辅助文件/GrassEye 结构化日志与运行证明施工图.md` | structured event chain must not silently skip required operator-visible stages | latest log silently jumps from dispatch-start to terminal result |
| Law/blueprint conclusion | No hard law change needed; blueprint detail should be sharpened | Governance wants traceable lifecycle already | Current gap is an implementation and enforcement omission |

## Not Promoted In This Phase

These observations are retained for backlog triage but not promoted to confirmed blockers because the latest pasted terminal log alone does not localize a production root cause strongly enough:

| Observation | Evidence | Why not promoted |
|---|---|---|
| `HUMAN_COMMAND_RECEIVED` missing in pasted terminal text | latest log jumps from startup ready to Forensics write requests and `HUMAN_COMMAND_VALIDATED` | code path and blueprint still declare the event; this phase did not rerun the mission to determine whether the loss is runtime, relay, or capture-side |
| `FORENSICS_RECORD_WRITTEN` missing in pasted terminal text | latest log repeatedly shows `FORENSICS_RECORD_WRITE_REQUESTED` only | code and audit both declare the completion event, so latest pasted terminal excerpt alone is insufficient to pin a live production defect |