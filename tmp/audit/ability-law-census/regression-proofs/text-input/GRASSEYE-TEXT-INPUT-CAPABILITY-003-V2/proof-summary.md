# GRASSEYE-TEXT-INPUT-CAPABILITY-003-V2 Proof Summary

scenarioId: text-input-capability-call-optional
mutationName: capability call optional mutation
mutatedFile: src/capabilities/text-input/schema.ts
coveredLawIds: GRASSEYE-TEXT-INPUT-CAPABILITY-003-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-003-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-003-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation weakens a required chain field in the input schema, proving Text Input input shape must preserve the full governed mission/capability chain.

## Result

- Mutated production file caused Text Input owner inspector FAIL.
- Rollback restored the production file and Text Input owner inspector PASS.
