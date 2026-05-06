# GRASSEYE-TEXT-INPUT-CAPABILITY-008-V2 Proof Summary

scenarioId: text-input-forbidden-child-registry
mutationName: forbidden child registry mutation
mutatedFile: src/capabilities/text-input/registry.ts
coveredLawIds: GRASSEYE-TEXT-INPUT-CAPABILITY-008-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-008-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-008-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation adds a non-governed send-message child into the registry, proving Text Input children must stay within the canonical primitive writing set.

## Result

- Mutated production file caused Text Input owner inspector FAIL.
- Rollback restored the production file and Text Input owner inspector PASS.
