# GRASSEYE-MOUSE-SCROLL-CAPABILITY-002-V2 Proof Summary

scenarioId: mouse-scroll-final-action-log-mutation
mutationName: mouse-scroll-final-action-log mutation
mutatedFile: src/capabilities/mouse-scroll/runtime/mouse-scroll-result-builder.ts
coveredLawIds: GRASSEYE-MOUSE-SCROLL-CAPABILITY-002-V2, GRASSEYE-MOUSE-SCROLL-CAPABILITY-006-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-002-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-002-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation leaks final action-log ownership into Mouse Scroll result building, proving Mouse Scroll cannot perform foreign-owner work.

## Result

- Mutated production file caused Mouse Scroll owner inspector FAIL.
- Rollback restored the production file and Mouse Scroll owner inspector PASS.
