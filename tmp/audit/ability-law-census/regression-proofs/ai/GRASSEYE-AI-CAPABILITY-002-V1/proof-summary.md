# GRASSEYE-AI-CAPABILITY-002-V1 Proof Summary

scenarioId: debug-emitter-required-mutation
mutationName: debug emitter required mutation
mutatedFile: src/capabilities/ai/ability-group.ts
coveredLawIds: GRASSEYE-AI-CAPABILITY-002-V1
failOutput: tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-002-V1/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-002-V1/inspector-pass-output.txt

## Why This Law Is Covered

The mutation lets ASK AI continue without a structured debug emitter, proving AI_REQUEST_DEBUG is a hard execution precondition.

## Result

- Mutated production file caused AI owner inspector FAIL.
- Rollback restored the production file and AI owner inspector PASS.
