# GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-003-V2 Production Mutation

scenarioId: input-schema-missing-capability-call-id
mutationName: input-schema-missing-capability-call-id
mutatedFile: src/capabilities/post-action-verification/schema.ts
coveredLawIds: GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-003-V2
beforeHash: sha256:d33661870eb30678d6ce8905b2e2e8e0e2990596413cb7407a5bb6305ed4f421
afterMutationHash: sha256:4c6dcab77d1783096d218034754400ea5a3cd320d81019283fc9cd8117f48c92

The mutation removes a machine-required chain field from the public input schema, proving Post Action Verification must keep the governed mission/run/activation chain machine-required.
