# GRASSEYE-AI-CAPABILITY-002-V1 Proof Summary

scenarioId: debug-event-wiring-mutation
mutationName: debug event wiring mutation
mutatedFile: src/capabilities/ai/runtime-factory.ts
coveredLawIds: GRASSEYE-AI-CAPABILITY-002-V1
failOutput: tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-002-V1/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-002-V1/inspector-pass-output.txt

## Why This Law Is Covered

The mutation removes emitDebugEvent from the configured runtime factory, proving AI_ERROR_DEBUG cannot silently disconnect from structured runtime logging.

## Result

- Mutated production file caused AI owner inspector FAIL.
- Rollback restored the production file and AI owner inspector PASS.
