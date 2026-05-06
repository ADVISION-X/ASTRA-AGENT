# GRASSEYE-OPEN-CAPABILITY-003-V2 Proof Summary

scenarioId: request-chain-mutation
mutationName: request chain mutation
mutatedFile: src/capabilities/open/schema-core.ts
coveredLawIds: GRASSEYE-OPEN-CAPABILITY-003-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/open/GRASSEYE-OPEN-CAPABILITY-003-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/open/GRASSEYE-OPEN-CAPABILITY-003-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation removes required step chain data from Open schema, proving every Open request must preserve the governed mission/map/step chain.

## Result

- Mutated production file caused Open owner inspector FAIL.
- Rollback restored the production file and Open owner inspector PASS.
