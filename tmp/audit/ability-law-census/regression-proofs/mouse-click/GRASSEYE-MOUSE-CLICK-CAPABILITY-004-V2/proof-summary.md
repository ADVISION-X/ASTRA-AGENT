# GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V2 Proof Summary

scenarioId: policy-gate-bypass-mutation
mutationName: policy gate bypass mutation
mutatedFile: src/capabilities/mouse-click/runtime/mouse-click-preflight-stages.ts
coveredLawIds: GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V2
failOutput: tmp/audit/ability-law-census/regression-proofs/mouse-click/GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V2/inspector-fail-output.txt
rollbackPassOutput: tmp/audit/ability-law-census/regression-proofs/mouse-click/GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V2/inspector-pass-output.txt

## Why This Law Is Covered

The mutation bypasses the governed click policy gate, proving Mouse Click must keep its fixed execution pipeline intact before any primitive click runs.

## Result

- Mutated production file caused Mouse Click owner inspector FAIL.
- Rollback restored the production file and Mouse Click owner inspector PASS.
