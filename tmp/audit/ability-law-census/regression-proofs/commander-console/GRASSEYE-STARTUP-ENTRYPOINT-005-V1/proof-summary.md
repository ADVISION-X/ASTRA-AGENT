# GRASSEYE-STARTUP-ENTRYPOINT-005-V1 Proof Summary

scenarioId: startup-controlled-exit-classification-removal-mutation
mutationName: startup controlled exit classification removal mutation
mutatedFile: scripts/startup/launch-grasseye.mjs
coveredLawIds: GRASSEYE-STARTUP-ENTRYPOINT-005-V1
failOutput: tmp/audit/ability-law-census/regression-proofs/commander-console/GRASSEYE-STARTUP-ENTRYPOINT-005-V1/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/commander-console/GRASSEYE-STARTUP-ENTRYPOINT-005-V1/inspector-pass-output.txt

## Why This Law Is Covered

The mutation removes SIGTERM and exit code 143 from controlled-shutdown classification, proving Commander startup must reject regressions in governed startup exit handling.

## Result

- Mutated production file caused Commander Console owner inspector FAIL.
- Rollback restored the production file and Commander Console owner inspector PASS.
