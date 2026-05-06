# GRASSEYE-SCREENSHOT-CAPABILITY-008-V2 Proof Summary

scenarioId: screenshot-negative-proof-removed
mutationName: remove-negative-proof-invocation mutation
mutatedFile: scripts/audit/domains/screenshot-capability/inspector.ts
coveredLawIds: GRASSEYE-SCREENSHOT-CAPABILITY-008-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/screenshot/GRASSEYE-SCREENSHOT-CAPABILITY-008-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/screenshot/GRASSEYE-SCREENSHOT-CAPABILITY-008-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation removes Screenshot's negative-proof invocation from the owner inspector, proving enforcement must remain inspector-wired and negative-proof-backed.

## Result

- Mutated production file caused Screenshot owner inspector FAIL.
- Rollback restored the production file and Screenshot owner inspector PASS.
