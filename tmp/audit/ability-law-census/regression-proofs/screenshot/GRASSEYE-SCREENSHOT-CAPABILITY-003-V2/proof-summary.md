# GRASSEYE-SCREENSHOT-CAPABILITY-003-V2 Proof Summary

scenarioId: screenshot-nullable-capability-call-id
mutationName: nullable chain field regression mutation
mutatedFile: src/capabilities/screenshot/shared/screenshot-governance.ts
coveredLawIds: GRASSEYE-SCREENSHOT-CAPABILITY-003-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/screenshot/GRASSEYE-SCREENSHOT-CAPABILITY-003-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/screenshot/GRASSEYE-SCREENSHOT-CAPABILITY-003-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation weakens a required V2 chain field in screenshot governance, proving screenshot input truth must preserve hard-required chain fields.

## Result

- Mutated production file caused Screenshot owner inspector FAIL.
- Rollback restored the production file and Screenshot owner inspector PASS.
