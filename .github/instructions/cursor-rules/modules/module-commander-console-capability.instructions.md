---
name: "GrassEye Commander Console Capability"
description: "Use when defining the Commander Console ability group, human command entry, mission dashboard, runtime proof timeline, review queue, or read-only operator console surfaces."
applyTo: ".github/instructions/cursor-rules/modules/module-commander-console-capability.instructions.md, src/capabilities/commander-console/**, src/app/task-api-handlers.ts, src/app/candidate-api-handlers.ts, src/lib/local-runtime/workbench.ts, scripts/audit/domains/commander-console-capability/**, docs/法案辅助文件/GrassEye Commander Console 总司令控制台能力组施工图.md"
---

# GrassEye Commander Console Capability

Scope: governs human command entry, mission dashboard, audit-facing console reads, and candidate review surfaces.
Boundary: this module governs the Commander Console Ability Group only.
Excludes: mission map progression internals, platform action execution, AI runtime internals, and final evidence persistence ownership.
Authority: this file is authoritative only for the commander-console-capability domain.

---

## Law GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V1

status: active
tier: P0
capabilityDomain: commander-console-capability
enforcementMode: manual-first
evidenceMode: law

summary: Commander Console is the only owner of human command entry, review disposition entry, and command-facing operator dashboard read models.

### 主题

总司令控制台主权

### 法条

Commander Console Ability Group is the only owner of human mission-command entry, review disposition entry, and command-facing operator dashboard read models.

Required direction:
- Human start, pause, resume, stop, and emergency-stop commands must enter through Commander Console.
- Human approve, reject, hold, inspect-record, and review-required decisions must enter through Commander Console.
- Commander Console must emit governed HumanCommandEnvelope traffic through Nerve Bus transport rather than holding a raw Orchestration ability object.
- Commander Console command transport may target Orchestration for mission commands and the active governed review or persistence surface for review commands.
- Commander Console mission-start input must preserve operator-selected requestedPlatformId or selectedMapId and must not silently inject a default platform on behalf of the operator.
- Task API routes must call Commander Console public methods rather than workbench command proxies or agent runtime command methods.
- Commander Console may expose mission dashboard, capability roster, capability health, runtime proof timeline, review queue, audit summary, evidence packets, browse ledger, and failed-record views as read-only console surfaces.
- Commander Console read models must live under src/capabilities/commander-console and may be rendered only by src/lib/local-app-shell or src/app consumers.
- Commander Console read models must enter only through Commander-facing public ports: OrchestrationMissionReadModel, ForensicsReadModelPort, CapabilityHealthReadModelPort, AuditReadModelPort, and RuntimeProofReadModelPort.
- Commander Console public contracts must define Commander-owned view records and must not re-export raw runtime, evidence, AI, task-run, or operator-snapshot truth.
- Commander Console public contracts may expose a Commander-owned mission-run reference only with Commander naming and must not preserve TaskRun or activeTaskRunId as Commander-facing truth.
- Commander Console child abilities must live in real child folders under src/capabilities/commander-console/children.

### 禁止

FORBIDDEN:
- task-api-handlers directly calling workbench.startTask, workbench.pauseTask, workbench.stopTask, or agent-service command methods.
- task-api-handlers, candidate-api-handlers, or create-workbench-server importing operator-control as a command or review owner.
- operator-control, workbench, or startup code owning start, pause, resume, stop, emergency-stop, approve, reject, or mark-review-required truth.
- local shell becoming a second command owner beside Commander Console.
- UI calling Commander Console child abilities, AI runtime, BrowserController, or final evidence writers directly.
- hidden human-command paths outside Commander Console.
- Commander Console importing ../../features/local-data from its canonical root.
- Commander Console importing ../../types/agent-skill, ../../types/evidence-packet as read-model truth, ../../types/local-ai, ../../types/runtime BrowseRuntimeSnapshot, or ../../types/task-run as public contract truth.
- Commander Console exposing resetLocalStore or raw OrchestrationAbilityGroup on its public interface.
- Commander Console using defaultRequestedPlatformId fallback, requestedPlatformId ?? "tiktok-web", or any other silent platform default as mission-command truth.
- Commander Console preserving TaskRun or activeTaskRunId naming on Commander-facing contracts, page models, or dashboard labels.
- Commander Console constructing ProductOpportunityCandidate or maintaining AgentMechanicalSkill catalog material.

---

## Law GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V1

status: active
tier: P0
capabilityDomain: commander-console-capability
enforcementMode: manual-first
evidenceMode: law

summary: Commander Console reads governed truth only and must not create a second runtime truth or preserve old workbench demo truth.

### 主题

控制台只读真相边界

### 法条

Commander Console must consume governed truth from Commander-facing public read-model ports only.

Required direction:
- mission dashboard must derive runtime proof timeline from RuntimeProofReadModelPort.
- browse/evidence/review screens must read from ForensicsReadModelPort.
- capability roster must consume ability-group truth rather than child implementation truth.
- capability health must consume CapabilityHealthReadModelPort.
- mission state must consume OrchestrationMissionReadModel.
- audit summary must consume AuditReadModelPort rather than hand-maintained console-only summaries.
- display fields sourced from governed mission/runtime state must be renamed into Commander-owned view records before they reach Commander-facing contracts or shell page models.
- any retained UI copy, styles, or layout helpers from deleted operator-control paths must be rebuilt as Commander Console read models or Local App Shell rendering material only.

### 禁止

FORBIDDEN:
- Commander Console writing final evidence packets, failed records, browse ledgers, or structured logs.
- Commander Console inventing UI-only runtime truth that cannot be traced back to governed logs or records.
- Commander Console advancing operational-map step state.
- demo state, prototype data, placeholder action state, or skill-matrix-only snapshots acting as governed runtime truth.
- Commander Console contract directly exposing OperatorSnapshotRecord, AgentSkillMatrixSnapshot, ProductDiscoveryEvidencePacket, BrowseRuntimeSnapshot, RuntimeDeliveryState, LocalAiTaskResult, TaskRun, or mutable ProductOpportunityCandidate domain objects.

---

## Law GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-003-V1

status: active
tier: P0
capabilityDomain: commander-console-capability
enforcementMode: manual-first
evidenceMode: law

summary: Commander Console must keep hard boundaries away from browser, platform-action, AI runtime, and storage internals.

### 主题

控制台边界纯洁度

### 法条

Commander Console must stay as a console-facing ability group and must not import browser-controller, platform-adapter internals, or local AI runtime internals.

Required direction:
- Browser state, platform capability health, and local AI health may enter Commander Console only through injected read providers.
- Commander Console may coordinate candidate disposition only by emitting governed human-review commands through its command transport seam.
- Local App Shell may render Commander Console outputs, but it must stay render-only and must not own command truth or mission truth.
- Startup may open Commander Console after health passes, but it must remain bootstrap-only and must not trigger governed mission start.

### 禁止

FORBIDDEN:
- importing BrowserController or browser primitive owners inside src/capabilities/commander-console.
- importing platform-action adapters or platform runtime implementations inside src/capabilities/commander-console.
- importing LocalAiGateway or local-ai runtime internals inside src/capabilities/commander-console.
- Commander Console directly calling agent runtime command methods.
- Commander Console importing operator-control paths, workbench rendering payloads, or deleted historical console wrappers.
- Commander Console importing storage-port implementations, reset-store helpers, or maintenance helpers from local-data or forensics storage internals.
- Commander Console directly calling orchestration.startMission, orchestration.pauseMission, orchestration.resumeMission, orchestration.stopMission, orchestration.emergencyStop, or setCandidateDisposition-style review mutations.
- Commander Console relying on browser-shell composition to choose a requestedPlatformId when the human command omitted it.

---

## Law GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1

status: active
tier: P0
capabilityDomain: commander-console-capability
enforcementMode: manual-first
evidenceMode: law

summary: Commander Console must own one canonical root, one child catalog, and zero compat bridges.

### 主题

唯一 canonical root 与 child catalog

### 法条

Commander Console must live under one canonical root with one internal child catalog and inspector-owned enforcement.

Required direction:
- canonical root is src/capabilities/commander-console.
- the child catalog must include issue-human-command, dashboard, proof, review, mission-control, and inspect-record surfaces as real child folders.
- the capability domain must ship one blueprint file, one manifest, one inspector, and one phase-gate entry.
- any UI shell render helpers migrated from operator-control must live under src/lib/local-app-shell with Commander Console-owned read-model contracts.
- commander-console-capability must be enforced by audit, not by verify-* scripts.
- decisive enforcement for forbidden imports and owner cutover must use AST, symbol resolution, or import-graph analysis rather than grep-only checks.

### 禁止

FORBIDDEN:
- compat, legacy, bridge, or dual-root commander console paths.
- src/features/operator-control as an active root, fallback root, render root, or compatibility root.
- exporting child internals outside the canonical root.
- scripts/verify/verify-commander-console-capabilities.ts as a release gate.
- runtime-skill-catalog.ts, runtime-skill-resolution.ts, build-runtime-skill-matrix-snapshot.ts, build-browse-runtime-snapshot.ts, and build-pending-analysis-candidate.ts surviving as active Commander Console source truth.

---

## Law GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-005-V2

status: active
tier: P0
capabilityDomain: commander-console-capability
enforcementMode: manual-first
evidenceMode: law

summary: Commander Console may read Forensics truth only through governed read models and must not import store internals.

### 主题

Commander 只读 Forensics 真相，不得直连旧 store 或维护方法。

### 法条

Commander Console may consume Forensics record summaries, review queues, and inspect-record views only through governed read-model ports.

### 禁止

FORBIDDEN:
- Importing EvidenceStoreService, src/capabilities/forensics-persistence/shared/store/**, getOperatorSnapshot, resetLocalStore, setCandidateDisposition, deleteCandidate, or advancedAiExports.
- Using ProductDiscoveryEvidencePacket, LocalAiTaskResult, ActionLog, RuntimeDeliveryState, or ProductOpportunityCandidate as Commander public read-model contract truth.
