# GRASSEYE-MOUSE-CLICK-CAPABILITY-001-V2 Proof Summary

scenarioId: platform-adapter-direct-click-mutation
mutationName: platform-adapter-direct-click mutation
mutatedFile: src/lib/local-runtime/workbench-mouse-click-runtime.ts
coveredLawIds: GRASSEYE-MOUSE-CLICK-CAPABILITY-001-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/mouse-click/GRASSEYE-MOUSE-CLICK-CAPABILITY-001-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/mouse-click/GRASSEYE-MOUSE-CLICK-CAPABILITY-001-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation lets the workbench composition root invoke a click primitive directly, proving governed click execution truth remains owned by Mouse Click.

## Result

- Mutated production file caused Mouse Click owner inspector FAIL.
- Rollback restored the production file and Mouse Click owner inspector PASS.
