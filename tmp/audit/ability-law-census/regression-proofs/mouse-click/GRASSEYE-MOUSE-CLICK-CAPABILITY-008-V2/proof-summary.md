# GRASSEYE-MOUSE-CLICK-CAPABILITY-008-V2 Proof Summary

scenarioId: manual-first-enforcement-mutation
mutationName: manual-first-enforcement mutation
mutatedFile: .github/instructions/cursor-rules/modules/module-mouse-click-capability.instructions.md
coveredLawIds: GRASSEYE-MOUSE-CLICK-CAPABILITY-008-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/mouse-click/GRASSEYE-MOUSE-CLICK-CAPABILITY-008-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/mouse-click/GRASSEYE-MOUSE-CLICK-CAPABILITY-008-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation downgrades Mouse Click enforcement to manual-first, proving this domain must remain machine-blocking through its owner-local inspector and negative-proof chain.

## Result

- Mutated production file caused Mouse Click owner inspector FAIL.
- Rollback restored the production file and Mouse Click owner inspector PASS.
