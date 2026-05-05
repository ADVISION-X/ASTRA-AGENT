# Law / Blueprint Mapping

## BLOCKER-1

- Problem: `MISSION_PREFLIGHT_PASSED` and `NERVE_BUS_DISPATCH_STARTED`, then `COMMAND_REJECTED failureReason=invalid_input`.
- Law file: `.github/instructions/cursor-rules/modules/module-orchestration-capability.instructions.md`
- lawId: `GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1`; start boundary supplement `GRASSEYE-ORCHESTRATION-CAPABILITY-008-V3`
- Law requirement: final readiness requires `activationSnapshotRef frozen and non-null in valid execution`, `dispatch only through Nerve Bus envelope`, and `step payload/proof carries full chain fields`.
- Blueprint file: `docs/法案辅助文件/GrassEye Orchestration 总指挥能力组施工图.md`
- Blueprint section: `start-mission preflight 补充`, lines 683-691.
- Blueprint requirement: Local App Shell must dry-run the final `MissionCommandSchema` before Nerve Bus dispatch; dry-run must include requestedPlatform, selectedMapId/preferredMapId, taskTemplateId, activationId, targetProfileRef, and non-null generated runId. Failure must return `MISSION_PREFLIGHT_FAILED / COMMAND_REJECTED` before envelope creation.
- Violation: rejection happened after passed preflight and Nerve Bus dispatch.
- Gap status: law exists, blueprint exists, enforcement is incomplete for end-to-end post-preflight rejection prevention.

## BLOCKER-2

- Problem: `MISSION_ACTIVATION_SNAPSHOT_FROZEN failed` includes `activationSnapshotRef=...` and actionableMessage says continue the loop.
- Law file: `.github/instructions/cursor-rules/modules/module-structured-logging.instructions.md`
- lawId: structured logging human command / mission preflight event law
- Law requirement: command rejection logs must include failureReason, ownerResponsible, actionableMessage, inspect/debug refs.
- Blueprint file: `docs/法案辅助文件/GrassEye 结构化日志与运行证明施工图.md`
- Blueprint section: `Human Command / Mission Preflight Events`, lines 131-135.
- Blueprint requirement: governed event chain must make rejection traceable.
- Violation: event semantics are contradictory; snapshot-freeze proof and later mission-loop failure are conflated.
- Gap status: law exists, blueprint exists, inspector only checks event literal presence.

## BLOCKER-3

- Problem: `MAP_STEP_SELECTED`, `CAPABILITY_CALL_*`, `POST_ACTION_VERIFICATION_*`, `FORENSICS_RECORD_*`, `STEP_TRANSITION_EVALUATED`, and mission finalization events are missing.
- Law file: `.github/instructions/cursor-rules/modules/module-orchestration-capability.instructions.md`
- lawId: `GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1`
- Law requirement: step payload/proof must carry full chain fields; PAV-after-action and Forensics routing must be enforced.
- Blueprint file: `docs/法案辅助文件/GrassEye Orchestration 总指挥能力组施工图.md`
- Blueprint section: final readiness lines 873-890.
- Blueprint requirement: dispatch only through Nerve Bus envelope, PAV-after-action, Forensics routing, transition evaluation through declared schema fields.
- Violation: runtime logs do not prove or localize those phases.
- Gap status: blueprint/law require behavior, but structured logging event emission is not enforced.

## BLOCKER-4

- Problem: older live runtime logs show `open requires targetUrl or explicit targetProfileRef ...; silent profile defaulting is forbidden` after preflight.
- Law file: `.github/instructions/cursor-rules/modules/module-open-capability.instructions.md`
- lawId: `GRASSEYE-OPEN-CAPABILITY-003-V2`
- Law requirement: Open input must have `targetUrl or targetProfileRef`; target URL may be resolved only by governed target profile/explicit policy.
- Forbidden: silent default platform, silent default URL, fabricated target profile.
- Blueprint file: `docs/法案辅助文件/GrassEye Open 能力组施工图.md`
- Blueprint section: target profile governance lines 290-299; output proof fields lines 535-545.
- Blueprint requirement: target profile is a governed profile, not silent fallback; results/proofs carry targetProfileRef, targetUrl, targetUrlSource.
- Violation: upstream dispatch can reach open without explicit target binding.
- Gap status: Open law/inspector guard the open module, but cross-domain propagation is missing.

## Law Gap Candidates

No direct law change is required for this phase. The gaps are enforcement and blueprint-detail gaps, not clear law absence.

## Blueprint Detail Gaps

- The Orchestration blueprint should explicitly distinguish `MISSION_ACTIVATION_SNAPSHOT_FROZEN` proof semantics from mission-loop execution outcome.
- The structured logging blueprint should require every listed mission-loop phase to be emitted by the production loop, not only named in relay allowlists.
- The cross-domain Commander/Orchestration/Open path needs an explicit proof: task binding `targetProfileRef` must reach first open step input or preflight must block before transport.
