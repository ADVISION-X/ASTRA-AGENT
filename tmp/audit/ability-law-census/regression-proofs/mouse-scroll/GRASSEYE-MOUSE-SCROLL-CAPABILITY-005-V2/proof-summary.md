# GRASSEYE-MOUSE-SCROLL-CAPABILITY-005-V2 Proof Summary

scenarioId: policy-gate-bypass-mutation
mutationName: policy gate bypass mutation
mutatedFile: src/capabilities/mouse-scroll/runtime/mouse-scroll-execution-validator.ts
coveredLawIds: GRASSEYE-MOUSE-SCROLL-CAPABILITY-005-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-005-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-005-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation bypasses the governed scroll policy gate, proving Mouse Scroll must keep its fixed execution pipeline intact before primitive scroll execution.

## Result

- Mutated production file caused Mouse Scroll owner inspector FAIL.
- Rollback restored the production file and Mouse Scroll owner inspector PASS.
