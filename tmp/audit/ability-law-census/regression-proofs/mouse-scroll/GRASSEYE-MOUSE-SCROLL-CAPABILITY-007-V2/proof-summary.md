# GRASSEYE-MOUSE-SCROLL-CAPABILITY-007-V2 Proof Summary

scenarioId: proof-drop-mutation
mutationName: proof drop mutation
mutatedFile: src/capabilities/mouse-scroll/runtime/mouse-scroll-result-builder.ts
coveredLawIds: GRASSEYE-MOUSE-SCROLL-CAPABILITY-007-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-007-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-007-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation drops the runtime proof from Mouse Scroll result assembly, proving result and runtime proof must preserve the real upstream chain.

## Result

- Mutated production file caused Mouse Scroll owner inspector FAIL.
- Rollback restored the production file and Mouse Scroll owner inspector PASS.
