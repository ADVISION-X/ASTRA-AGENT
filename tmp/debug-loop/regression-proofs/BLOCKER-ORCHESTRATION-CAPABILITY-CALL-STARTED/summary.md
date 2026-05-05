# BLOCKER-ORCHESTRATION-CAPABILITY-CALL-STARTED

- Production mutation: changed `eventType: "CAPABILITY_CALL_STARTED"` to `eventType: "CAPABILITY_CALL_SKIPPED"` in `src/capabilities/orchestration/runtime/orchestration-loop-iteration-events.ts`.
- Expected fail evidence: `inspector-fail-output.txt`
- Rollback pass evidence: `rollback-proof.txt`
- Result: orchestration owner inspector fails on the real production regression and passes again after rollback.