# GRASSEYE-OPEN-CAPABILITY-009-V1 Proof Summary

scenarioId: remove-macos-local-platform-mutation
mutationName: remove macos-local platform mutation
mutatedFile: src/capabilities/open/shared/open-target-profile.ts
coveredLawIds: GRASSEYE-OPEN-CAPABILITY-009-V1
failOutput: tmp/audit/ability-law-census/regression-proofs/open/GRASSEYE-OPEN-CAPABILITY-009-V1/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/open/GRASSEYE-OPEN-CAPABILITY-009-V1/inspector-pass-output.txt

## Why This Law Is Covered

The mutation removes the macOS local-program platform from Open target profile support, proving the governed local-program path must remain present and complete.

## Result

- Mutated production file caused Open owner inspector FAIL.
- Rollback restored the production file and Open owner inspector PASS.
