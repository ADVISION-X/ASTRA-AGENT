---
name: "GrassEye Commander Console Capability"
description: "Use when governing the Commander Console Ability Group, human command entry, mission-control commands (pause/resume/stop/emergency-stop/mark-review-required), minimal mission status read, and the boundary that prevents Commander from becoming Orchestration, Forensics, AI, browser/action owner, or read-model universe."
applyTo: ".github/instructions/cursor-rules/modules/module-commander-console-capability.instructions.md, src/capabilities/commander-console/**, src/app/task-api-handlers.ts, src/lib/local-runtime/workbench.ts, src/lib/local-app-shell/**, scripts/audit/domains/commander-console-capability/**, docs/法案辅助文件/GrassEye Commander Console 总司令控制台能力组施工图.md"
---

# GrassEye Commander Console Capability FINAL

Scope: governs human command entry, mission-control commands, review_required visible stop, and minimal mission status read.
Boundary: Commander governs only human entry and minimal status read. It does not own mission flow, prompt truth, AI runtime truth, browser/action execution, persistence truth, read-model universes, evidence/audit/browse ledger display, or candidate disposition.
Authority: this file is authoritative only for the commander-console-capability domain.

Core doctrine:
- Commander Console is the cockpit for humans, not the engine.
- Commander receives initial human intent and explicit human control commands.
- Commander emits governed HumanCommandEnvelope.
- Commander does not own read-model universes.
- Commander does not own candidate disposition.
- Commander does not own evidence/audit/browse ledgers.
- Commander does not own review continuation.
- Commander must not revive retired navigation-chain or retired branch-token truth as command truth.
- Commander must not create an implicit auto-continue route after review; restart requires a new governed human command.

Active command surface — exactly:
- issue-human-command (start-mission only)
- pause-mission
- resume-mission
- stop-mission
- emergency-stop
- mark-review-required
- show-mission-status (minimal read, not a dashboard universe)

Forbidden children (physically deleted):
- show-mission-dashboard
- show-audit-summary
- show-browse-ledger
- show-evidence-packets
- show-failed-records
- show-runtime-proof-timeline
- show-capability-roster
- show-capability-health
- inspect-record-detail
- show-review-queue
- approve-candidate
- reject-candidate

## Law GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V3

status: active
tier: P0
capabilityDomain: commander-console-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Commander Console is the only owner of human command entry and review-disposition entry.

### 主题

人类命令入口主权唯一

### 法条

Human mission commands and human review decisions must enter through Commander Console.

Required review direction:
- `review_required` reasons from AI or other capability groups must be surfaced in Commander read models.
- `STOP_REVIEW_REQUIRED` is a legal stop actionCode that must resolve to Commander-visible review handling.
- Commander review handling belongs to human disposition and a later restart command, not to in-flight runtime continuation.

Required envelope fields:
- commandId
- commandType
- operatorRef
- humanGoal or userRequirementText
- selectedPlatforms for start-mission
- maxRounds when applicable
- maxMinutes when applicable
- operatorNote when applicable
- payload
- idempotencyKey
- timeoutMs

Required:
- Task API routes call Commander public interface only.
- Candidate review API routes call Commander public interface only.
- Commander emits governed HumanCommandEnvelope to Orchestration through Nerve Bus only.
- pause-mission, resume-mission, stop-mission, emergency-stop, and mark-review-required remain governed command emissions only; Orchestration owns the resulting runtime state transition.
- no silent default platform.

Forbidden:
- legacy platform-plus-map binding as required start-mission truth.
- legacy activation binding as active command truth.
- retired branch tokens or retired deterministic flow planning in human command envelopes.
- Commander directly holding Orchestration or action owners.
- implicit runtime continue after human review without a new governed command envelope.

## Law GRASSEYE-HUMAN-COMMAND-BOUNDARY-V1

status: active
tier: P0
capabilityDomain: commander-console-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: issue-human-command is start-mission-only and Commander command entry must not absorb round continuity or revive approve/reject command routes.

### 主题

Human Command 降权边界

### 法条

Commander human command entry must stay minimal and must not absorb runtime continuity or in-loop review control.

Required:
- `issue-human-command` owns only `start-mission`.
- `issue-human-command` boundaryDecision stays `command-transport-only`.
- `issue-human-command` schema requires governed `requestedPlatformId` and governed `initialPayload`.
- Commander active children may expose only `issue-human-command`, `pause-mission`, `resume-mission`, `stop-mission`, `emergency-stop`, `mark-review-required`, and `show-mission-status`.
- `show-mission-status` returns only missionId, status, currentPlatform, userRequirementSummary, startedAt, updatedAt, lastStopReason, reviewRequiredReason, savedEvidenceCount, failedActionCount.
- Review stop handling remains Commander-visible, but ordinary round progression remains outside the human command surface.

Forbidden:
- `issue-human-command` accepting `roundId`, `roundIndex`, `previousRoundId`, `currentPhase`, `aiResultRef`, or other per-round continuity fields.
- reviving `approve-candidate` or `reject-candidate` as Commander command routes.
- rebuilding deleted candidate-handler transport shortcuts after the command boundary has been collapsed into Commander + governed runtime routing.

## Final Readiness Gate

The Commander law is ready only when:
- start-mission envelopes use userRequirementText plus selectedPlatforms and contain no retired map truth.
- active children number exactly 7: issue-human-command, pause-mission, resume-mission, stop-mission, emergency-stop, mark-review-required, show-mission-status.
- no read-model universe children exist in the capability group.
- no candidate dispose/approve/reject children exist.
- src/capabilities/commander-console file count is ≤ 18.
