# GRASSEYE-TEXT-INPUT-CAPABILITY-002-V2 Proof Summary

scenarioId: text-input-write-only-browser-import
mutationName: child forbidden browser import mutation
mutatedFile: src/capabilities/text-input/children/type-text/implementation.ts
coveredLawIds: GRASSEYE-TEXT-INPUT-CAPABILITY-002-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-002-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/text-input/GRASSEYE-TEXT-INPUT-CAPABILITY-002-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation imports browser runtime internals into a Text Input child, proving the write-only boundary rejects foreign-owner and browser-internal dependencies.

## Result

- Mutated production file caused Text Input owner inspector FAIL.
- Rollback restored the production file and Text Input owner inspector PASS.
