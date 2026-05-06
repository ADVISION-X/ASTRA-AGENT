# GRASSEYE-MOUSE-SCROLL-CAPABILITY-008-V2 Proof Summary

scenarioId: platform-business-verb-child-mutation
mutationName: platform-business-verb-child mutation
mutatedFile: src/capabilities/mouse-scroll/registry.ts
coveredLawIds: GRASSEYE-MOUSE-SCROLL-CAPABILITY-008-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-008-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-008-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation injects a platform business verb into the Mouse Scroll child registry, proving children must remain narrow primitive bindings only.

## Result

- Mutated production file caused Mouse Scroll owner inspector FAIL.
- Rollback restored the production file and Mouse Scroll owner inspector PASS.
