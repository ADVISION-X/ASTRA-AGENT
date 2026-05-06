# GRASSEYE-OPEN-CAPABILITY-008-V2 Proof Summary

scenarioId: warning-only-p0-mutation
mutationName: warning-only-p0 mutation
mutatedFile: .github/instructions/cursor-rules/modules/module-open-capability.instructions.md
coveredLawIds: GRASSEYE-OPEN-CAPABILITY-008-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/open/GRASSEYE-OPEN-CAPABILITY-008-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/open/GRASSEYE-OPEN-CAPABILITY-008-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation downgrades Open active law severity from P0 to warning-only, proving enforcement must remain machine-blocking and negative-proof backed.

## Result

- Mutated production file caused Open owner inspector FAIL.
- Rollback restored the production file and Open owner inspector PASS.
