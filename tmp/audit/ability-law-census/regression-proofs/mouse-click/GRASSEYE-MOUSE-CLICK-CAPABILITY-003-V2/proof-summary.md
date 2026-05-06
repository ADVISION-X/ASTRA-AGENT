# GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V2 Proof Summary

scenarioId: input-capabilitycallid-removal-mutation
mutationName: input capabilityCallId removal mutation
mutatedFile: src/capabilities/mouse-click/schema.ts
coveredLawIds: GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/mouse-click/GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/mouse-click/GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation removes a required chain field from Mouse Click input schema, proving execution input must preserve full upstream chain identity.

## Result

- Mutated production file caused Mouse Click owner inspector FAIL.
- Rollback restored the production file and Mouse Click owner inspector PASS.
