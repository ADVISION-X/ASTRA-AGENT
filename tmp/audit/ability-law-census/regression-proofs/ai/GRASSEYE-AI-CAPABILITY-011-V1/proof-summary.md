# GRASSEYE-AI-CAPABILITY-011-V1 Proof Summary

scenarioId: prompt-registry-throw-mutation
mutationName: prompt registry throw mutation
mutatedFile: src/capabilities/ai/runtime/ai-prompt-registry.ts
coveredLawIds: GRASSEYE-AI-CAPABILITY-011-V1
failOutput: tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-011-V1/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-011-V1/inspector-pass-output.txt

## Why This Law Is Covered

The mutation changes typed prompt resolution failure into a throw, proving prompt execution must route through governed typed failures.

## Result

- Mutated production file caused AI owner inspector FAIL.
- Rollback restored the production file and AI owner inspector PASS.
