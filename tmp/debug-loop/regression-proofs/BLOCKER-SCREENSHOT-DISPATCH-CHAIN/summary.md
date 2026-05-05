# BLOCKER-SCREENSHOT-DISPATCH-CHAIN

- Production mutation: changed `capabilityCallId: envelope.capabilityCallId` to `capabilityCallId: envelope.missionId` in `src/lib/local-runtime/workbench-screenshot-dispatch-input.ts`.
- Expected fail evidence: `inspector-fail-output.txt`
- Rollback pass evidence: `rollback-proof.txt`
- Result: screenshot owner inspector fails on the real production regression and passes again after rollback.