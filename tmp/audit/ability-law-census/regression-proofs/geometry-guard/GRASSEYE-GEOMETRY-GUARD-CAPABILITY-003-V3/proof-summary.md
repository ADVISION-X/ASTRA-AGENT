# GRASSEYE-GEOMETRY-GUARD-CAPABILITY-003-V3 Proof Summary

scenarioId: remove-capabilitycallid-from-input
mutationName: remove-capabilityCallId-from-input
mutatedFile: src/capabilities/geometry-guard/schema-input.ts
coveredLawIds: GRASSEYE-GEOMETRY-GUARD-CAPABILITY-003-V3
failOutput: tmp/audit/ability-law-census/regression-proofs/geometry-guard/GRASSEYE-GEOMETRY-GUARD-CAPABILITY-003-V3/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/geometry-guard/GRASSEYE-GEOMETRY-GUARD-CAPABILITY-003-V3/inspector-pass-output.txt

## Why This Law Is Covered

The mutation removes a required input chain field, proving Geometry Guard input must preserve the governed execution chain.

## Result

- Mutated production file caused Geometry Guard owner inspector FAIL.
- Rollback restored the production file and Geometry Guard owner inspector PASS.
