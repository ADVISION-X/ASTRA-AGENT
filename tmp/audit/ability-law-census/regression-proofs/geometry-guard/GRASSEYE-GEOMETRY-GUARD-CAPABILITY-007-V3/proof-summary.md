# GRASSEYE-GEOMETRY-GUARD-CAPABILITY-007-V3 Proof Summary

scenarioId: mouse-click-scale-mapping-remap
mutationName: mouse-click-scale-mapping-remap
mutatedFile: src/capabilities/mouse-click/runtime/mouse-click-execution-seed.ts
coveredLawIds: GRASSEYE-GEOMETRY-GUARD-CAPABILITY-007-V3
failOutput: tmp/audit/ability-law-census/regression-proofs/geometry-guard/GRASSEYE-GEOMETRY-GUARD-CAPABILITY-007-V3/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/geometry-guard/GRASSEYE-GEOMETRY-GUARD-CAPABILITY-007-V3/inspector-pass-output.txt

## Why This Law Is Covered

The mutation makes Mouse Click remap scaleMapping downstream of Geometry Guard, proving downstream action groups cannot recompute executable geometry.

## Result

- Mutated production file caused Geometry Guard owner inspector FAIL.
- Rollback restored the production file and Geometry Guard owner inspector PASS.
