# GRASSEYE-TEXT-INPUT-CAPABILITY-004-V2 Proof Summary

scenarioId: text-input-abort-signal-removed
mutationName: abort signal removal mutation
mutatedFile: src/capabilities/text-input/runtime/primitive-text-input-runner.ts
coveredLawIds: GRASSEYE-TEXT-INPUT-CAPABILITY-004-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-004-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-004-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation removes AbortSignal handoff from the primitive runner, proving Text Input execution must preserve governed timeout and cancellation enforcement.

## Result

- Mutated production file caused Text Input owner inspector FAIL.
- Rollback restored the production file and Text Input owner inspector PASS.
