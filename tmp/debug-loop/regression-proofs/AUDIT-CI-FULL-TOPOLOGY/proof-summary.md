coveredLawIds:
- GRASSEYE-AUDIT-SYSTEM-001-V1

Mutated production file caused audit-system to FAIL:
- file: scripts/audit/ci-full.ts
- mutation: independent-preflight parallel stage changed from true to false
- observed: ci-full-topology phase reported SCRIPT OVERREACH

Rollback restored the production file:
- rollback: PASS observed after restoring parallel: true

Evidence:
- mutated-file.patch
- inspector-fail-output.txt
- rollback-proof.txt
- inspector-pass-output.txt
