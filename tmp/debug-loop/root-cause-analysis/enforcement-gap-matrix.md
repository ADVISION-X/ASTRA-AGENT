# Enforcement Gap Matrix

Legend:

- `C`: static presence / ownership check only
- `D`: no live runtime sequence assertion
- `E`: no success-path negative proof
- `G`: no read-model parity assertion
- `J`: no non-empty producer assertion

| Blocker | Inspector file | Negative proof file | Current coverage | Missed production problem | Why it did not block | Category |
|---|---|---|---|---|---|---|
| 1. No step chain after acceptance | `scripts/audit/domains/orchestration-capability/run-governed-runtime-checks.ts` | `scripts/audit/domains/orchestration-capability/negative-proof-harness.ts` | Checks frozen activation, proof fields, PAV gate, and map lookup boundaries | No `MAP_STEP_SELECTED`, `STEP_DISPATCH_STARTED`, `CAPABILITY_CALL_*`, `STEP_TRANSITION_EVALUATED`, or mission outcome events are emitted after accepted command | Inspector validates structure, not emitted runtime sequence | C, D, E |
| 2. Empty action timeline | `scripts/audit/domains/forensics-persistence-capability/run-forensics-structured-log-runtime-checks.ts`; `scripts/audit/domains/structured-logging/run-structured-logging-checks.ts` | No current negative proof targets empty action-log producer set | Checks command flow event names, terminal fields, and ownership of `writeStructuredActionLog` calls if present | Repository contains zero production `writeStructuredActionLog` call sites, so `/api/runtime/actions` can stay permanently empty and still pass | Checks do not require any producer to exist | C, D, J |
| 3. Commander proof timeline lacks success-path proof | `scripts/audit/domains/orchestration-capability/run-governed-runtime-checks.ts`; `scripts/audit/domains/commander-console-capability/run-commander-runtime-checks.ts` | `scripts/audit/domains/orchestration-capability/negative-proof-harness.ts`; `scripts/audit/domains/commander-console-capability/negative-proof-harness.ts` | Checks runtime proof schemas, runId handling, transport semantics, and gate wiring | Success-path proof refs are not persisted into mission state and runtime proof read model depends only on `structuredRuntimeEvents` | No inspector compares accepted-command outcome with Commander-visible proof timeline | C, D, E, G |

## Detailed Findings

### Orchestration inspector gap

`scripts/audit/domains/orchestration-capability/run-governed-runtime-checks.ts` is useful for activation/proof/gate invariants, but repository search shows no audit coverage for:

- `MAP_STEP_SELECTED`
- `STEP_PRECONDITION_CHECKED`
- `CAPABILITY_CALL_STARTED`
- `STEP_TRANSITION_EVALUATED`

That means the current accepted-command silence is outside the active blocking assertions.

### Structured action-log gap

`scripts/audit/domains/structured-logging/run-structured-logging-checks.ts` builds `actionLogCalls` and validates ownership through `allCallsCarryOrchestrationOwnership(actionLogCalls)`, but does not fail when `actionLogCalls` is empty. Current repository state matches that blind spot exactly: the action-log contract exists, but no producer calls it.

### Commander read-model gap

`scripts/audit/domains/commander-console-capability/run-commander-runtime-checks.ts` validates Commander runtime gates and proof schema surfaces, but does not assert that:

- accepted mission start creates a Commander-visible post-acceptance proof chain;
- runtime proof timeline contains step/transition/finalization entries;
- mission dashboard can read back the last accepted mission state after task start.

## Required Enforcement Additions

- Add a machine-blocking inspector phase that requires post-acceptance emission or persistence of step-phase proof, not just task-start events.
- Add a negative proof that removes success-path proof persistence and requires failure.
- Add a producer-existence audit for `writeStructuredActionLog`, not just ownership validation if calls happen to exist.
- Add a Commander read-model parity check: accepted mission start must produce a non-empty governed post-acceptance proof timeline or an explicit terminal outcome record.
