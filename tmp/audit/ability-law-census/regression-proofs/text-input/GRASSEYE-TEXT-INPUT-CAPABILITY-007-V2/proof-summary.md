# GRASSEYE-TEXT-INPUT-CAPABILITY-007-V2 Proof Summary

scenarioId: text-input-fabricated-run-id
mutationName: fabricated run id mutation
mutatedFile: src/capabilities/text-input/runtime/text-input-proof-builder.ts
coveredLawIds: GRASSEYE-TEXT-INPUT-CAPABILITY-007-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-007-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-007-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation fabricates runId inside the runtime proof builder, proving Text Input proof truth must preserve the real chain rather than local synthetic refs.

## Result

- Mutated production file caused Text Input owner inspector FAIL.
- Rollback restored the production file and Text Input owner inspector PASS.
