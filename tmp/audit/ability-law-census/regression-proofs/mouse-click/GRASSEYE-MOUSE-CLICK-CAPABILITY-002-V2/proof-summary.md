# GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V2 Proof Summary

scenarioId: mouse-click-final-action-log-mutation
mutationName: mouse-click-final-action-log mutation
mutatedFile: src/capabilities/mouse-click/runtime/mouse-click-result-builder.ts
coveredLawIds: GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V2, GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/mouse-click/GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/mouse-click/GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation leaks final action-log ownership into Mouse Click result building, proving Mouse Click cannot perform foreign-owner work.

## Result

- Mutated production file caused Mouse Click owner inspector FAIL.
- Rollback restored the production file and Mouse Click owner inspector PASS.
