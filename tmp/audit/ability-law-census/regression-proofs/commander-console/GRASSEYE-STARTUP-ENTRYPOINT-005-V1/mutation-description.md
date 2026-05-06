# GRASSEYE-STARTUP-ENTRYPOINT-005-V1 Production Mutation

scenarioId: startup-exit-controlled-shutdown-classification
mutationName: startup controlled exit classification removal mutation
mutatedFile: scripts/startup/launch-grasseye.mjs
coveredLawIds: GRASSEYE-STARTUP-ENTRYPOINT-005-V1
beforeHash: sha256:00fad6ea4902a7fbbdab51b77ad272be7c2f999197c38e9517efcaedcdd35405
afterMutationHash: sha256:f38d19fc3141b5f701d81a673243cbc373a54dff8ce645e267b93ade35cfda73

The mutation removes SIGTERM and exit code 143 from controlled-shutdown classification, proving Commander startup must reject regressions in governed startup exit handling.
