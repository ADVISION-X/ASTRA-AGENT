# GRASSEYE-GEOMETRY-GUARD-CAPABILITY-006-V3 Proof Summary

scenarioId: proof-runid-from-session-child
mutationName: proof-runId-from-session-child
mutatedFile: src/capabilities/geometry-guard/runtime/geometry-proof-builder.ts
coveredLawIds: GRASSEYE-GEOMETRY-GUARD-CAPABILITY-006-V3
failOutput: tmp/audit/ability-law-census/regression-proofs/geometry-guard/GRASSEYE-GEOMETRY-GUARD-CAPABILITY-006-V3/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/geometry-guard/GRASSEYE-GEOMETRY-GUARD-CAPABILITY-006-V3/inspector-pass-output.txt

## Why This Law Is Covered

The mutation fabricates a proof identity from local child data, proving Geometry Guard result and runtime proof must preserve real upstream chain truth.

## Result

- Mutated production file caused Geometry Guard owner inspector FAIL.
- Rollback restored the production file and Geometry Guard owner inspector PASS.
