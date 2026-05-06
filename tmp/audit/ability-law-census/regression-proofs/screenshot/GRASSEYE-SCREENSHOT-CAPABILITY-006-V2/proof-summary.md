# GRASSEYE-SCREENSHOT-CAPABILITY-006-V2 Proof Summary

scenarioId: screenshot-region-crop-flattening
mutationName: region crop flattening mutation
mutatedFile: src/capabilities/screenshot/registry.ts
coveredLawIds: GRASSEYE-SCREENSHOT-CAPABILITY-006-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/screenshot/GRASSEYE-SCREENSHOT-CAPABILITY-006-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/screenshot/GRASSEYE-SCREENSHOT-CAPABILITY-006-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation collapses region-crop transform truth back to source-image coordinates, proving Screenshot must preserve governed transform image kinds and coordinate-space lineage.

## Result

- Mutated production file caused Screenshot owner inspector FAIL.
- Rollback restored the production file and Screenshot owner inspector PASS.
