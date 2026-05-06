# GRASSEYE-MOUSE-SCROLL-CAPABILITY-009-V2 Proof Summary

scenarioId: manual-first-enforcement-mutation
mutationName: manual-first-enforcement mutation
mutatedFile: .github/instructions/cursor-rules/modules/module-mouse-scroll-capability.instructions.md
coveredLawIds: GRASSEYE-MOUSE-SCROLL-CAPABILITY-009-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-009-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/mouse-scroll/GRASSEYE-MOUSE-SCROLL-CAPABILITY-009-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation downgrades Mouse Scroll enforcement to manual-first, proving this domain must close through machine-blocking inspector, runner, and negative proof.

## Result

- Mutated production file caused Mouse Scroll owner inspector FAIL.
- Rollback restored the production file and Mouse Scroll owner inspector PASS.
