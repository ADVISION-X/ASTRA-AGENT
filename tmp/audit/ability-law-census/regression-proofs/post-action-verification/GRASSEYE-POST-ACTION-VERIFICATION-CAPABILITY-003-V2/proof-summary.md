# GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-003-V2 Proof Summary

scenarioId: input-schema-missing-capability-call-id
mutationName: input-schema-missing-capability-call-id
mutatedFile: src/capabilities/post-action-verification/schema.ts
coveredLawIds: GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-003-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/post-action-verification/GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-003-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/post-action-verification/GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-003-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation removes a machine-required chain field from the public input schema, proving Post Action Verification must keep the governed mission/run/activation chain machine-required.

## Result

- Mutated production file caused Post Action Verification owner inspector FAIL.
- Rollback restored the production file and Post Action Verification owner inspector PASS.
