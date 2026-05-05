# Enforcement Gap Matrix

| Blocker | Inspector file | Negative proof file | Current coverage | Missed production problem | Why it did not block | Category |
|---|---|---|---|---|---|---|
| 1 | `scripts/audit/domains/orchestration-capability/start-mission-boundary-checks.ts`; `scripts/audit/domains/commander-console-capability/run-startup-readiness-gate-checks.ts` | `scripts/audit/domains/orchestration-capability/negative-proof-harness.ts`; `scripts/audit/domains/commander-console-capability/negative-proof-harness.ts` | Checks `envelope.runId`, event literal presence, `MissionCommandSchema.safeParse`, and binding fields | Preflight can still pass before downstream `invalid_input` command rejection | Static AST checks do not execute final command plus first-step path; negative proof mutates local symbols, not runtime propagation | C, D, E, F |
| 2 | `scripts/audit/domains/orchestration-capability/start-mission-boundary-checks.ts` | `scripts/audit/domains/orchestration-capability/negative-proof-harness.ts` | Checks that `MISSION_ACTIVATION_SNAPSHOT_FROZEN` literal exists | Event can be semantically contradictory: failed status with present snapshot and continue action | Inspector does not validate status/reason/actionable consistency | C, D, E, H |
| 3 | `scripts/audit/domains/orchestration-capability/run-governed-runtime-checks.ts` | `scripts/audit/domains/orchestration-capability/negative-proof-harness.ts` | Checks frozen state/proof fields, PAV gate call, no floating active map lookup | Runtime loop emits no visible `MAP_STEP_SELECTED`, capability, PAV, Forensics, transition logs | Inspector checks proof structures and gate calls, not runtime log emission coverage | C, D, E, H |
| 4 | `scripts/audit/domains/open-capability/run-open-runtime-checks.ts`; Commander/Orchestration startup gate inspectors | `scripts/audit/domains/open-capability/negative-proof-harness.ts`; Commander/Orchestration negative proof harnesses | Open input gate, fake allow prevention, fallback URL pattern checks | Task binding targetProfileRef can be lost before open input | Domain-local inspectors do not verify cross-domain payloadRefs propagation into first open step | C, D, E, F, I |

## Detailed Enforcement Findings

### Orchestration inspector

`scripts/audit/domains/orchestration-capability/run-governed-runtime-checks.ts` covers frozen state/proof fields and imports `inspectStartMissionCommandBoundary`. It does not assert that `runMissionLoopIteration` emits structured runtime phase events. Its negative proof harness includes runId removal, boundary log removal, MissionCommandSchema preflight mutation, and PAV gate bypass, but not a mutation that drops `targetProfileRef` from the first open dispatch payload.

### Commander startup readiness inspector

`scripts/audit/domains/commander-console-capability/run-startup-readiness-gate-checks.ts` checks that `getMissionStartPreflight` receives `taskTemplateId`, `activationId`, `activationSnapshotRef`, and `targetProfileRef`; that `workbench-status` has `commandTransportContract`; and that `MissionCommandSchema.safeParse` appears. This is necessary but insufficient: it proves the preflight component exists, not that the final Nerve Bus payload or first ability input contains the same binding.

### Open inspector

`scripts/audit/domains/open-capability/run-open-runtime-checks.ts` and `negative-proof-harness.ts` defend the Open module against fake/fallback behavior. They correctly protect the target policy gate, but do not own the upstream `Commander -> Orchestration -> Nerve Bus -> Open` propagation path. The runtime failure proves cross-domain enforcement is needed.

## Required Enforcement Additions

- Add an orchestration/commander cross-domain inspector phase that checks `targetProfileRef` and/or target profile proof travels from `task-start-flow` approval binding into `MissionState.payloadRefs`, then into `buildAbilityDispatchDocument`, then into `buildOpenAbilityInput`.
- Add negative proof that removes `targetProfileRef` propagation and requires failure at preflight, before `NERVE_BUS_ENVELOPE_CREATED`.
- Add structured log inspector that requires production emitters for `MAP_STEP_SELECTED`, `STEP_PRECONDITION_CHECKED`, `CAPABILITY_CALL_*`, `POST_ACTION_VERIFICATION_*`, `FORENSICS_RECORD_*`, `STEP_TRANSITION_EVALUATED`, and terminal mission outcome events.
- Add log semantic inspector for `MISSION_ACTIVATION_SNAPSHOT_FROZEN`: snapshot freeze success/failure must not be inferred from later mission status.
