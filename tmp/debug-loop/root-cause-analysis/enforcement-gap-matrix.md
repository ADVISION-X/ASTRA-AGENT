# Enforcement Gap Matrix

| Blocker | Inspector file | Negative proof file | Current coverage | Why it still passed | Required enforcement improvement |
|---|---|---|---|---|---|
| BLOCKER-1 Screenshot chain fields dropped before ability entry | `scripts/audit/domains/screenshot-capability/required-shape.ts` plus scope control in `config.ts` and `project-access.ts` | `scripts/audit/domains/screenshot-capability/negative-proof-harness.ts` | Checks Screenshot schema, governance shapes, input gate, proof/result builders, lifecycle gates, and internal owner files | The broken file is `src/lib/local-runtime/workbench-action-dispatch-inputs.ts`, which is outside `PATHS.ROOT = src/capabilities/screenshot`; no inspector or mutation watches envelope-to-input mapping there | Extend audit scope to cover cross-boundary workbench adapter mapping or add a shared adapter inspector; add mutation deleting chain fields inside `buildScreenshotCommand`; fail owner audit when adapter omits required fields |
| BLOCKER-2 Missing `CAPABILITY_CALL_STARTED` event | `scripts/audit/domains/orchestration-capability/mission-loop-event-semantics-checks.ts` | `scripts/audit/domains/orchestration-capability/negative-proof-harness.ts` | Checks `MAP_STEP_SELECTED`, `STEP_PRECONDITION_CHECKED`, `STEP_DISPATCH_STARTED`, `STEP_TRANSITION_EVALUATED`, terminal outcomes, and `POST_ACTION_VERIFICATION_STARTED` | The required event set does not include `CAPABILITY_CALL_STARTED`, so Orchestration can pass audit while lifecycle start remains implicit | Add explicit lifecycle-event matrix enforcement for `CAPABILITY_CALL_STARTED`; add a negative proof that deletes or renames the event and must fail |

## Gap Classification Summary

### BLOCKER-1

- C: law exists, inspector scope does not include the failing adapter boundary.
- D: checks are mostly file-local snippets/AST presence, not end-to-end envelope-to-input dataflow.
- E: no negative proof mutates `buildScreenshotCommand`.

### BLOCKER-2

- C: governance wants traceable lifecycle, but inspector does not encode this event as mandatory.
- D: mission-loop semantics audit validates only a narrower event set.
- E: no deletion mutation exists for `CAPABILITY_CALL_STARTED`.

## Non-Promoted Observability Anomalies

The latest pasted terminal log also misses `HUMAN_COMMAND_RECEIVED` and `FORENSICS_RECORD_WRITTEN`, but those were not promoted in this phase because code and static audit still declare them, and this phase did not produce a fresh live rerun to localize the contradiction to a specific runtime file with the same confidence level as the two confirmed blockers above.