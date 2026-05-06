# GRASSEYE-OPEN-CAPABILITY-006-V2 Proof Summary

scenarioId: proof-chain-mutation
mutationName: proof chain mutation
mutatedFile: src/capabilities/open/runtime/open-proof-builder.ts
coveredLawIds: GRASSEYE-OPEN-CAPABILITY-006-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/open/GRASSEYE-OPEN-CAPABILITY-006-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/open/GRASSEYE-OPEN-CAPABILITY-006-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation removes capabilityCallId from Open runtime proof construction, proving Open result and proof must preserve real chain and browser-session truth.

## Result

- Mutated production file caused Open owner inspector FAIL.
- Rollback restored the production file and Open owner inspector PASS.
