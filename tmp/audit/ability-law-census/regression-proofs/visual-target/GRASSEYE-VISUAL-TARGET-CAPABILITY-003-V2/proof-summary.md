# GRASSEYE-VISUAL-TARGET-CAPABILITY-003-V2 Proof Summary

scenarioId: visual-target-missing-capability-call-id
mutationName: remove-capabilityCallId-from-input
mutatedFile: src/capabilities/visual-target/shared/visual-target-governance.ts
coveredLawIds: GRASSEYE-VISUAL-TARGET-CAPABILITY-003-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/visual-target/GRASSEYE-VISUAL-TARGET-CAPABILITY-003-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/visual-target/GRASSEYE-VISUAL-TARGET-CAPABILITY-003-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation removes a required chain field from the governed input schema, proving Visual Target rejects incomplete chain-bearing inputs.

## Result

- Mutated production file caused Visual Target owner inspector FAIL.
- Rollback restored the production file and Visual Target owner inspector PASS.
