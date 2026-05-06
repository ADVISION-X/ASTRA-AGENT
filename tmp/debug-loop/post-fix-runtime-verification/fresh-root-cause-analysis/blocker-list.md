# Fresh Blocker List

## BLOCKER-FRESH-1

- status: current
- priority: P0
- first failing event: `CAPABILITY_CALL_FAILED prepare-ai-input`
- failureReason: `prepare-ai-input proof requires scaleMapping`
- affected mission: `tiktok-seeding-video-discovery`
- old blocker status: `BLOCKER-RUNTIME-1` missing `source` is not reproduced; fresh failure occurs later in the same Screenshot handoff chain.
- root owner: Screenshot
- enforcement gap: Screenshot inspector covers source handoff but does not yet force `prepare-ai-input` success proof to carry `scaleMapping` through the production result path.
