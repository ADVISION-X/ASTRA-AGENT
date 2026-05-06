# GRASSEYE-SCREENSHOT-CAPABILITY-006-V2 Production Mutation

scenarioId: screenshot-region-crop-flattening
mutationName: region crop flattening mutation
mutatedFile: src/capabilities/screenshot/registry.ts
coveredLawIds: GRASSEYE-SCREENSHOT-CAPABILITY-006-V2
beforeHash: sha256:f621f899cf9915f3e33f2cefec6358143583b8817376bccd466498d0f4267fd5
afterMutationHash: sha256:7a63d01548d1186398cc9e1c8e0b8aaeb9c41fa14c2e3f0706cf515ab0dd0187

The mutation collapses region-crop transform truth back to source-image coordinates, proving Screenshot must preserve governed transform image kinds and coordinate-space lineage.
