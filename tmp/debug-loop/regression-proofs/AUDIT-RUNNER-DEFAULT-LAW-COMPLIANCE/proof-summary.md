coveredLawIds:
- GRASSEYE-AUDIT-SYSTEM-001-V1

Mutated production file caused audit-system to FAIL:
- file: scripts/audit/runner.ts
- mutation: default heavy proof skip policy call removed from the audit runner
- observed: runner-boundary phase reported SCRIPT OVERREACH

Rollback restored the production file:
- rollback: PASS observed after restoring applyDefaultNegativeProofPolicy()

Evidence:
- mutated-file.patch
- inspector-fail-output.txt
- rollback-proof.txt
- inspector-pass-output.txt
