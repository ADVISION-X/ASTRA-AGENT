# GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-008-V2 Proof Summary

scenarioId: negative-proof-invocation-removed
mutationName: negative-proof-invocation-removed
mutatedFile: scripts/audit/domains/post-action-verification-capability/inspector.ts
coveredLawIds: GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-008-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/post-action-verification/GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-008-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/post-action-verification/GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-008-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation removes nested guarded negative-proof invocation from the inspector, proving PAV enforcement must close through the owner-local inspector, runner, and negative-proof harness.

## Result

- Mutated production file caused Post Action Verification owner inspector FAIL.
- Rollback restored the production file and Post Action Verification owner inspector PASS.
