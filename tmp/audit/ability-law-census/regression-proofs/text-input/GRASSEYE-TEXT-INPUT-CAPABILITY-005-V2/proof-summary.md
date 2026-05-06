# GRASSEYE-TEXT-INPUT-CAPABILITY-005-V2 Proof Summary

scenarioId: text-input-raw-debug-leak
mutationName: raw text debug leak mutation
mutatedFile: src/capabilities/text-input/runtime/text-input-debug-events.ts
coveredLawIds: GRASSEYE-TEXT-INPUT-CAPABILITY-005-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-005-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-005-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation leaks raw input text into the debug bundle, proving Text Input must keep sensitive text transient and redacted outside request scope.

## Result

- Mutated production file caused Text Input owner inspector FAIL.
- Rollback restored the production file and Text Input owner inspector PASS.
