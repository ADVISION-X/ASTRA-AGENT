# GRASSEYE-MOUSE-CLICK-CAPABILITY-006-V2 Proof Summary

scenarioId: proof-fabricated-runid-mutation
mutationName: proof fabricated runId mutation
mutatedFile: src/capabilities/mouse-click/runtime/mouse-click-proof-builder.ts
coveredLawIds: GRASSEYE-MOUSE-CLICK-CAPABILITY-006-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/mouse-click/GRASSEYE-MOUSE-CLICK-CAPABILITY-006-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/mouse-click/GRASSEYE-MOUSE-CLICK-CAPABILITY-006-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation fabricates a runtime proof identity field, proving Mouse Click runtime proof must preserve the real upstream execution chain.

## Result

- Mutated production file caused Mouse Click owner inspector FAIL.
- Rollback restored the production file and Mouse Click owner inspector PASS.
