# GRASSEYE-OPEN-CAPABILITY-001-V2 Proof Summary

scenarioId: external-private-leak-mutation
mutationName: external private-leak mutation
mutatedFile: src/lib/local-runtime/workbench-open-runtime.ts
coveredLawIds: GRASSEYE-OPEN-CAPABILITY-001-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/open/GRASSEYE-OPEN-CAPABILITY-001-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/open/GRASSEYE-OPEN-CAPABILITY-001-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation lets external runtime code import a private Open executor surface, proving governed open behavior must remain owned by the Open Ability Group public contract.

## Result

- Mutated production file caused Open owner inspector FAIL.
- Rollback restored the production file and Open owner inspector PASS.
