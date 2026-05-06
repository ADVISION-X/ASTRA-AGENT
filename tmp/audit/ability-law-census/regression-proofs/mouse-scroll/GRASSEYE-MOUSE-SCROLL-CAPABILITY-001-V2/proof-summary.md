# GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V2 Proof Summary

scenarioId: platform-direct-scroll-mutation
mutationName: platform-direct-scroll mutation
mutatedFile: src/lib/local-runtime/workbench-mouse-scroll-runtime.ts
coveredLawIds: GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation lets the workbench runtime invoke a primitive scroll directly, proving governed scroll execution truth remains owned by Mouse Scroll.

## Result

- Mutated production file caused Mouse Scroll owner inspector FAIL.
- Rollback restored the production file and Mouse Scroll owner inspector PASS.
