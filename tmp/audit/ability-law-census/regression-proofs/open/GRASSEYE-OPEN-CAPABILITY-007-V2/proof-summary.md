# GRASSEYE-OPEN-CAPABILITY-007-V2 Proof Summary

scenarioId: export-star-mutation
mutationName: export star mutation
mutatedFile: src/capabilities/open/index.ts
coveredLawIds: GRASSEYE-OPEN-CAPABILITY-007-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/open/GRASSEYE-OPEN-CAPABILITY-007-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/open/GRASSEYE-OPEN-CAPABILITY-007-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation reintroduces export-star on the Open package root, proving package shape must stay canonical and explicit.

## Result

- Mutated production file caused Open owner inspector FAIL.
- Rollback restored the production file and Open owner inspector PASS.
