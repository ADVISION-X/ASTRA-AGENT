# GRASSEYE-AI-CAPABILITY-013-V1 Proof Summary

scenarioId: proof-chain-mutation
mutationName: proof chain mutation
mutatedFile: src/capabilities/ai/runtime/ai-proof-builder.ts
coveredLawIds: GRASSEYE-AI-CAPABILITY-013-V1
failOutput: tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-013-V1/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-013-V1/inspector-pass-output.txt

## Why This Law Is Covered

The mutation removes capabilityCallId from runtime proof identity, proving AI result proofs must remain complete and chain-linked.

## Result

- Mutated production file caused AI owner inspector FAIL.
- Rollback restored the production file and AI owner inspector PASS.
