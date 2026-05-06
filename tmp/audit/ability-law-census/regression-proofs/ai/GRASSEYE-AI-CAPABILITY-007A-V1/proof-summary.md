# GRASSEYE-AI-CAPABILITY-007A-V1 Proof Summary

scenarioId: ai-debug-trace-step-unsanctioned-stepid-mutation
mutationName: ai debug trace step unsanctioned stepId mutation
mutatedFile: src/lib/local-runtime/workbench-ai-debug-support.ts
coveredLawIds: GRASSEYE-AI-CAPABILITY-007A-V1
failOutput: tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-007A-V1/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-007A-V1/inspector-pass-output.txt

## Why This Law Is Covered

The mutation reverts the AI debug trace step field to use input.stepId, which is an orchestration map step ID not in the RoundLifecycleStepSchema enum, causing StructuredRuntimeEventSchema.parse to throw at runtime and silently suppressing AI_REQUEST_DEBUG from the terminal observer. The proof chain inspector must catch this regression.

## Result

- Mutated production file caused AI owner inspector FAIL.
- Rollback restored the production file and AI owner inspector PASS.
