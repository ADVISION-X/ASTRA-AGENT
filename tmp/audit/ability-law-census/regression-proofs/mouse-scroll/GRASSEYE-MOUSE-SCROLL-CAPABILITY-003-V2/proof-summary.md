# GRASSEYE-MOUSE-SCROLL-CAPABILITY-003-V2 Proof Summary

scenarioId: result-output-null-guard-mutation
mutationName: result output null guard mutation
mutatedFile: src/capabilities/mouse-scroll/schema.ts
coveredLawIds: GRASSEYE-MOUSE-SCROLL-CAPABILITY-003-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-003-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-003-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation removes the schema-level output=null guard for failed and review_required results, proving Mouse Scroll schema must preserve its governed result invariants.

## Result

- Mutated production file caused Mouse Scroll owner inspector FAIL.
- Rollback restored the production file and Mouse Scroll owner inspector PASS.
