# GRASSEYE-AI-CAPABILITY-004-V1 Proof Summary

scenarioId: public-index-helper-mutation
mutationName: public index helper mutation
mutatedFile: src/capabilities/ai/index.ts
coveredLawIds: GRASSEYE-AI-CAPABILITY-001-V1, GRASSEYE-AI-CAPABILITY-004-V1, GRASSEYE-AI-CAPABILITY-007-V1
failOutput: tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-004-V1/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-004-V1/inspector-pass-output.txt

## Why This Law Is Covered

The mutation breaks the static AI package public surface by leaking an internal runtime helper.

## Result

- Mutated production file caused AI owner inspector FAIL.
- Rollback restored the production file and AI owner inspector PASS.
