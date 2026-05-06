# GRASSEYE-AI-CAPABILITY-002-V1 Proof Summary

scenarioId: success-raw-output-hash-mutation
mutationName: success raw output hash mutation
mutatedFile: src/capabilities/ai/schema-runtime-success-invariants.ts
coveredLawIds: GRASSEYE-AI-CAPABILITY-002-V1, GRASSEYE-AI-CAPABILITY-013-V1
failOutput: tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-002-V1/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-002-V1/inspector-pass-output.txt

## Why This Law Is Covered

The mutation weakens raw response hash enforcement, proving ASK AI success requires rawResponseHash evidence.

## Result

- Mutated production file caused AI owner inspector FAIL.
- Rollback restored the production file and AI owner inspector PASS.
