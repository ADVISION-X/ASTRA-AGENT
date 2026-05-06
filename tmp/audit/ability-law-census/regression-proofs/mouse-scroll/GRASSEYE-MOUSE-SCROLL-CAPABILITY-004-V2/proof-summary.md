# GRASSEYE-MOUSE-SCROLL-CAPABILITY-004-V2 Proof Summary

scenarioId: scroll-until-found-loop-mutation
mutationName: scroll-until-found loop mutation
mutatedFile: src/capabilities/mouse-scroll/runtime/mouse-scroll-executor.ts
coveredLawIds: GRASSEYE-MOUSE-SCROLL-CAPABILITY-004-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-004-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-004-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation introduces a hidden until-found loop, proving direction, magnitude, and repeat must stay explicit input or policy rather than hidden runtime behavior.

## Result

- Mutated production file caused Mouse Scroll owner inspector FAIL.
- Rollback restored the production file and Mouse Scroll owner inspector PASS.
