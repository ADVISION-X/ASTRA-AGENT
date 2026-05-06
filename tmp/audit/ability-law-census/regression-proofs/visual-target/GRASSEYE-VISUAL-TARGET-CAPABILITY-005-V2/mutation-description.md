# GRASSEYE-VISUAL-TARGET-CAPABILITY-005-V2 Production Mutation

scenarioId: visual-target-critical-data-quality-fail-open
mutationName: critical-data-quality-fail-open
mutatedFile: src/capabilities/visual-target/runtime/visual-target-output-boundary-gate.ts
coveredLawIds: GRASSEYE-VISUAL-TARGET-CAPABILITY-005-V2
beforeHash: sha256:341b942d515b1261721f6a2f50fa2dfb5f699305b023ddbc5598f159d7b9b8a0
afterMutationHash: sha256:7747afb4e1362c488be8528c0b437a0d14411e1b6627bfeb7b48630f2d8470fa

The mutation removes critical_data_quality from the boundary's fail-closed set, proving the governed gate pipeline must stop on critical data-quality drift.
