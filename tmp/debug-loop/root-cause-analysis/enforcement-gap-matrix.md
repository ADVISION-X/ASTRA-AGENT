# Enforcement Gap Matrix

| Blocker | Inspector / proof that should have caught it | Current coverage | Gap category | Why it escaped | Required enforcement improvement |
|---|---|---|---|---|---|
| BLOCKER-1 | `scripts/audit/domains/commander-console-capability/run-commander-runtime-checks.ts`; `negative-proof-harness.ts` | Checks timeout gate exists, timeout outcome strings exist, and refs are preserved on rejected path | D, E, H | No check for async boundary: `issue-human-command` should not await full mission terminal state after `COMMAND_ACCEPTED` | Add AST check/negative proof for start-mission handler awaiting `orchestrationAbilityGroup.startMission` inside command transport; assert accepted command cannot later emit child-level `COMMAND_REJECTED` |
| BLOCKER-2 | `scripts/audit/domains/page-state-capability/required-shape.ts`; `anti-escape.ts`; `negative-proof-mutations.ts` | Checks observations exist, output boundary blocks missing observations, child output parses schema | C, D, E | No child-specific check that normal safety classification binds negative `captcha`/`safety_wall` observations into support refs | Add dataflow/AST check and mutation: remove negative normal safety refs should fail |
| BLOCKER-3 | Structured logging / orchestration lifecycle inspectors | Checks many required fields and command rejected field propagation | E, H | Event taxonomy completeness not enforced for capability-start and review terminal finalization | Add required lifecycle event matrix and negative proof deleting `CAPABILITY_CALL_STARTED` / review finalization |
| BLOCKER-4 | Page State result/proof inspector and structured logging inspector | Checks result/proof schema retains diagnostic refs | C, H | Does not require those refs to be surfaced in orchestration terminal review log | Add review-log mapping inspector for diagnosticPayloadRef/runtimeProofRef/observationRefs |

## Inspector Deletion / Warning-Only Status

No evidence found in this phase that the relevant Page State or Commander inspector is deleted or warning-only. The failure is coverage precision, not inspector absence.

## Negative Proof Gap Summary

- Existing Page State negative proof includes `local-runtime-page-state-drops-governed-observations`.
- Missing Page State negative proof: `detect-safety-page` normal branch ignores governed negative observations while observations still exist.
- Existing Commander negative proof includes timeout gate bypass.
- Missing Commander negative proof: start mission emits accepted event but command child still times out because transport awaits terminal mission loop.
