# GRASSEYE-AI-CAPABILITY-008-V1 Proof Summary

scenarioId: second-prompt-truth-mutation
mutationName: second prompt truth mutation
mutatedFile: src/lib/local-ai/prompt-registry.ts
coveredLawIds: GRASSEYE-AI-CAPABILITY-008-V1, GRASSEYE-AI-CAPABILITY-009-V1
failOutput: tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-008-V1/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-008-V1/inspector-pass-output.txt

## Why This Law Is Covered

The mutation creates a second local prompt catalog, proving Prompt Contract Registry remains the only prompt truth.

## Result

- Mutated production file caused AI owner inspector FAIL.
- Rollback restored the production file and AI owner inspector PASS.
