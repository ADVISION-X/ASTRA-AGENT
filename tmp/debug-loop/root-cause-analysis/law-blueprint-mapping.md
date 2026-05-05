# Law / Blueprint Mapping

## BLOCKER-1: Accepted Command With No Post-Acceptance Step Chain

- Problem: latest Facebook and TikTok traces both reach `COMMAND_ACCEPTED`, then no governed step / capability / PAV / finalization event becomes visible.
- Law file: `.github/instructions/cursor-rules/modules/module-orchestration-capability.instructions.md`
- lawId: `GRASSEYE-ORCHESTRATION-CAPABILITY-005-V3`
- Law requirement: step execution must remain map-driven, bounded, auditable, PAV-after-action enforced, Forensics routing enforced.
- lawId: `GRASSEYE-ORCHESTRATION-CAPABILITY-008-V3`
- Law requirement: runtime proof must preserve dispatch, transition, loop, and finalization chain.
- Blueprint file: `docs/法案辅助文件/GrassEye Orchestration 总指挥能力组施工图.md`
- Blueprint requirement: Orchestration story chain explicitly includes `step dispatch through Nerve Bus`, `transition evaluation`, and `Forensics persistence request`; Runtime Proof section requires transition and finalization proof fields.
- Blueprint file: `docs/法案辅助文件/GrassEye 结构化日志与运行证明施工图.md`
- Blueprint requirement: terminal relay is only display; structured runtime proof must still exist as governed persisted/read-model truth.
- Current violation: task-start acceptance is visible, but the mission loop is not.
- Gap status: active laws and blueprint exist; production emitters and enforcement coverage do not.

## BLOCKER-2: Action Timeline And Evidence Read Models Stay Empty

- Problem: `/api/runtime/actions` is empty and Commander snapshot still shows zero evidence/action outputs after accepted mission starts.
- Law file: `.github/instructions/cursor-rules/modules/module-orchestration-capability.instructions.md`
- lawId: `GRASSEYE-ORCHESTRATION-CAPABILITY-005-V3`
- Law requirement: evidence output must route to Forensics Persistence through governed request.
- Blueprint file: `docs/法案辅助文件/GrassEye 结构化日志与运行证明施工图.md`
- Blueprint requirement:
	- `structured_action_log` is an active governed payload type.
	- structured runtime/action payloads are generated upstream and persisted through Forensics.
	- browse ledger and evidence packet flows must be able to link back to structured records.
- Blueprint file: `docs/法案辅助文件/GrassEye Commander Console 总司令控制台能力组施工图.md`
- Blueprint requirement: Commander must display proof-backed runtime timeline, evidence packets, browse ledger, and other governed read models.
- Current violation: action/evidence read models remain empty because no upstream structured action-log producer is active.
- Gap status: blueprint expectation exists; producer presence is not enforced.

## BLOCKER-3: Success-Path Runtime Proof Does Not Reach Commander Timeline

- Problem: the accepted task-start chain tells the operator to monitor the runtime proof timeline, but Commander runtime proof view only contains task-start events and returns mission/runtime `idle` afterward.
- Law file: `.github/instructions/cursor-rules/modules/module-orchestration-capability.instructions.md`
- lawId: `GRASSEYE-ORCHESTRATION-CAPABILITY-003-V3`
- Law requirement: mission state, step dispatch proof, loop proof, and result proof must all carry frozen `activationSnapshotRef` and remain traceable to the selected activation snapshot.
- lawId: `GRASSEYE-ORCHESTRATION-CAPABILITY-008-V3`
- Law requirement: result/proof/state/input parity must preserve the real upstream chain.
- Blueprint file: `docs/法案辅助文件/GrassEye Orchestration 总指挥能力组施工图.md`
- Blueprint requirement: Runtime Proof section requires transition and finalization proof closure; READY gate requires `result/proof/state/input chain parity`.
- Blueprint file: `docs/法案辅助文件/GrassEye Commander Console 总司令控制台能力组施工图.md`
- Blueprint requirement: Commander runtime proof timeline must be proof-backed governed read model output, not proofless UI summary.
- Current violation: success-path proof is not surfaced in Commander read models after acceptance.
- Gap status: law and blueprint exist; success-path persistence/read-model parity is not enforced.

## No New Law Required

Current gaps are implementation and enforcement gaps, not a missing-law gap. The active Orchestration and Commander requirements already describe the expected outcome.

## Blueprint Detail Gaps Exposed By Current Evidence

- The Orchestration blueprint currently assumes runtime proof closure, but the production success path can remain invisible if only task-start structured events are written.
- The structured logging blueprint says terminal relay is not truth; current runtime still relies on task-start structured events as the only Commander-visible proof timeline.
- The Commander blueprint expects proof-backed read models, but current accepted traces show a dashboard-compatible read model with no post-acceptance proof chain.
