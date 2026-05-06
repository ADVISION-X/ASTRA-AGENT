# Fresh Law / Blueprint Mapping

## BLOCKER-FRESH-1

- law: Screenshot owner owns screenshot artifacts, image preparation, coordinate-space truth, and `scaleMapping`.
- blueprint: Screenshot construction requires `prepare-ai-input` to output an AI input artifact with `sourceScreenshotEvidenceId`, artifact refs, dimensions, hashes, and `scaleMapping`.
- runtime evidence: `CAPABILITY_CALL_FAILED` on `prepare-ai-input` with `path=["scaleMapping"]`.
- code evidence: `src/capabilities/screenshot/screenshot-schema-refinements.ts` rejects `prepare-ai-input` proof without `scaleMapping`; the production success path did not present it to the final proof.
- enforcement evidence: current negative proof proves source handoff, but does not mutate production code to remove/lose `scaleMapping` from `prepare-ai-input`.
