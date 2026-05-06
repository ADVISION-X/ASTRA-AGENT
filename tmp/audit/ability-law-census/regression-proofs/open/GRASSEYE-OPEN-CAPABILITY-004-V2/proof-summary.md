# GRASSEYE-OPEN-CAPABILITY-004-V2 Proof Summary

scenarioId: timeout-abort-mutation
mutationName: timeout abort mutation
mutatedFile: src/capabilities/open/runtime/navigation-runner-support.ts
coveredLawIds: GRASSEYE-OPEN-CAPABILITY-004-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/open/GRASSEYE-OPEN-CAPABILITY-004-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/open/GRASSEYE-OPEN-CAPABILITY-004-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation bypasses abort handling in navigation runner support, proving Open runtime governance must enforce timeout and cancellation behavior.

## Result

- Mutated production file caused Open owner inspector FAIL.
- Rollback restored the production file and Open owner inspector PASS.
