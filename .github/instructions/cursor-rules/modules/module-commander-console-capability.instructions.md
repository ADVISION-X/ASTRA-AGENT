---
name: "GrassEye Commander Console Capability"
description: "Use when governing the Commander Console Ability Group, human command entry, governed HumanCommandEnvelope transport, mission dashboard read models, owner evidence timeline, review queue, retired template flow UX, map import UX, and the boundary that prevents Commander from becoming Orchestration, Forensics, AI, or browser/action owner."
applyTo: ".github/instructions/cursor-rules/modules/module-commander-console-capability.instructions.md, src/capabilities/commander-console/**, src/app/task-api-handlers.ts, src/app/candidate-api-handlers.ts, src/lib/local-runtime/workbench.ts, src/lib/local-app-shell/**, scripts/audit/domains/commander-console-capability/**, docs/法案辅助文件/GrassEye Commander Console 总司令控制台能力组施工图.md"
---

# GrassEye Commander Console Capability FINAL

Scope: governs human command entry, governed command envelope creation, review-disposition entry, and commander read models.
Boundary: Commander governs only human entry and read-model presentation. It does not own mission flow, prompt truth, AI runtime truth, browser/action execution, or persistence truth.
Authority: this file is authoritative only for the commander-console-capability domain.

Core doctrine:
- Commander Console is the cockpit for humans, not the engine.
- Commander receives human intent and emits governed command envelopes.
- Commander start-mission truth is userRequirementText plus selectedPlatforms plus governed run limits.
- Commander must not revive retired navigation-chain or retired branch-token truth as command truth.
- Commander owns the human review gate and read-model explanation of review_required reasons.
- Commander must not create an implicit auto-continue route after review; restart requires a new governed human command.

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
- Commander emits governed HumanCommandEnvelope through transport only.
- no silent default platform.

Forbidden:
- legacy platform-plus-map binding as required start-mission truth.
- legacy activation binding as active command truth.
- retired branch tokens or retired deterministic flow planning in human command envelopes.
- Commander directly holding Orchestration or action owners.
- implicit runtime continue after human review without a new governed command envelope.

## Final Readiness Gate

The Commander law is ready only when start-mission envelopes use userRequirementText plus selectedPlatforms and contain no retired map truth.
