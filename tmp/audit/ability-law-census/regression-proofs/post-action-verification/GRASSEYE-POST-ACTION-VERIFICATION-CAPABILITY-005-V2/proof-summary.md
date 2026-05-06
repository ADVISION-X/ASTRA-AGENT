# GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-005-V2 Proof Summary

scenarioId: result-builder-drops-run-id
mutationName: result-builder-drops-run-id
mutatedFile: src/capabilities/post-action-verification/runtime/verification-result-builder.ts
coveredLawIds: GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-005-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/post-action-verification/GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-005-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/post-action-verification/GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-005-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation removes the governed request runId from the final result builder, proving Post Action Verification results must preserve mission/run chain parity from the governed request.

## Result

- Mutated production file caused Post Action Verification owner inspector FAIL.
- Rollback restored the production file and Post Action Verification owner inspector PASS.
