# GRASSEYE-STARTUP-ENTRYPOINT-005-V1 Production Mutation

scenarioId: startup-controlled-exit-classification-removal-mutation
mutationName: startup controlled exit classification removal mutation
mutatedFile: scripts/startup/launch-grasseye.mjs
coveredLawIds: GRASSEYE-STARTUP-ENTRYPOINT-005-V1
beforeHash: sha256:b3c65283a93e3d5b3be5dd81ee2a9d0d554747609561035247e65b67a0fb4520
afterMutationHash: sha256:88aa3c3ec8dd68e73379e1be3e7d62cf561fcfe0e89df86f9cc95c06a0b927c7

The mutation removes SIGTERM and exit code 143 from controlled-shutdown classification, proving Commander startup must reject regressions in governed startup exit handling.
