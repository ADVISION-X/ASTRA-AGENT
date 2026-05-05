# Enforcement Gap Matrix

Status: current inspectors can see parts of the runtime proof chain, but they do not yet enforce the six failure modes proven in the latest real run.

| ID | Blocker | Expected Enforcement | Current Inspector Surface | Confirmed Gap | Missing Negative Proof |
|---|---|---|---|---|---|
| B1 | `maxRounds` step-budget collision | Inspectors should reject any runtime where configured mission rounds are consumed as step-count budget and can stop the map before the next governed step. | Existing start-mission and runtime-log checks focus on event presence and integrity, not on mission-loop semantics. | No current inspector compares `configuredMaxRounds`, `currentRoundIndex`, active map transitions, and terminal status semantics together. | No inspector demonstrates that three successful steps can incorrectly force `detect-safety-page` to fail precondition and finalize `completed`. |
| B2 | Late `MISSION_ACTIVATION_SNAPSHOT_FROZEN` | Inspectors should require activation-snapshot proof before terminal mission proof. | `start-mission-boundary-checks.ts` verifies literal boundary events. | Literal presence passes even if `MISSION_ACTIVATION_SNAPSHOT_FROZEN` is logged after `MISSION_FINALIZED`. | No order-aware negative proof rejects activation snapshot freeze occurring after mission terminalization. |
| B3 | Late `COMMAND_ACCEPTED` | Inspectors should require acceptance to mean transport acceptance, not completion of the awaited mission promise. | `run-commander-runtime-runid-checks.ts` validates integrity and runId shape. | Integrity checks do not enforce lifecycle timing. `COMMAND_ACCEPTED` can exist with valid fields but still be semantically late. | No negative proof fails when `COMMAND_ACCEPTED` occurs only after mission finalization. |
| B4 | Missing `POST_ACTION_VERIFICATION_STARTED` | Inspectors should require both entry and exit markers for PAV in persisted runtime proof. | Current structured-log inspections do not require this event. | The persisted store can contain `POST_ACTION_VERIFICATION_PASSED` without a corresponding `POST_ACTION_VERIFICATION_STARTED` and still pass. | No negative proof asserts that verification may not complete unless verification start was recorded first. |
| B5 | Missing `FORENSICS_RECORD_WRITE_REQUESTED` and `FORENSICS_RECORD_WRITTEN` | Inspectors should require explicit persisted Forensics write-boundary events for structured-event and action-log writes. | Current structured logging / persistence checks focus on outcome presence, not write-boundary proof. | Direct persistence writes can succeed without any explicit request/write-complete event trail and still satisfy current checks. | No negative proof rejects runtime/event persistence that bypasses explicit `FORENSICS_RECORD_WRITE_REQUESTED` and `FORENSICS_RECORD_WRITTEN`. |
| B6 | Startup exit `143` misclassified as failure | Inspectors should distinguish startup failure from post-ready service termination. | `run-forensics-structured-log-runtime-checks.ts` and related startup checks consume failure-literal presence. | A run can fully reach healthy ready state and still end with `SERVICE_UNEXPECTED_EXIT failed` for code `143` without inspector rejection. | No negative proof ties exit classification to the already-proven ready/healthy state of the service. |

## Specific Inspector Notes

- `scripts/audit/domains/structured-logging/run-structured-logging-checks.ts` does include `inspectActionLogProducerCoverage(...)`, so the earlier “producer coverage missing” claim is stale.
- `scripts/audit/domains/commander-console-capability/start-mission-boundary-checks.ts` is currently literal-presence oriented rather than order-aware.
- `run-commander-runtime-runid-checks.ts` is integrity-aware rather than lifecycle-aware.
- `run-forensics-structured-log-runtime-checks.ts` can accept failure-classification literals without checking that the service had already reached ready state.
- No current inspector explicitly enforces `POST_ACTION_VERIFICATION_STARTED`.
- No current inspector explicitly enforces `FORENSICS_RECORD_WRITE_REQUESTED` / `FORENSICS_RECORD_WRITTEN`.
- No current inspector enforces the semantic relationship between `configuredMaxRounds`, `currentRoundIndex`, and the governed map step graph.

## Enforcement Verdict

The enforcement gap is not “no audits exist”. The real gap is that the current audit set is still too literal and too non-semantic to stop the six confirmed blockers.