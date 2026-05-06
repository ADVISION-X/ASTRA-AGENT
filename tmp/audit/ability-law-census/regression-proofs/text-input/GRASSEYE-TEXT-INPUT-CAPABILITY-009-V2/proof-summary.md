# GRASSEYE-TEXT-INPUT-CAPABILITY-009-V2 Proof Summary

scenarioId: text-input-negative-proof-removed
mutationName: negative proof invocation removed mutation
mutatedFile: scripts/audit/domains/text-input-capability/inspector.ts
coveredLawIds: GRASSEYE-TEXT-INPUT-CAPABILITY-009-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-009-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-009-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation disconnects the Text Input inspector from its negative-proof harness, proving release truth requires live inspector plus negative-proof wiring.

## Result

- Mutated production file caused Text Input owner inspector FAIL.
- Rollback restored the production file and Text Input owner inspector PASS.
