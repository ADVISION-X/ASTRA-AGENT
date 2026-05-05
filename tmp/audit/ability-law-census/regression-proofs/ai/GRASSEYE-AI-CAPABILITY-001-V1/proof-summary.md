# GRASSEYE-AI-CAPABILITY-001-V1 Proof Summary

scenarioId: forbidden-import-mutation
mutationName: forbidden import mutation
mutatedFile: src/capabilities/ai/runtime/ai-pre-runtime.ts
coveredLawIds: GRASSEYE-AI-CAPABILITY-001-V1, GRASSEYE-AI-CAPABILITY-003-V1, GRASSEYE-AI-CAPABILITY-010-V1
failOutput: tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-001-V1/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-001-V1/inspector-pass-output.txt

## Why This Law Is Covered

The mutation imports an action owner type into AI runtime code, proving AI ownership cannot mix with action ability groups.

## Result

- Mutated production file caused AI owner inspector FAIL.
- Rollback restored the production file and AI owner inspector PASS.
