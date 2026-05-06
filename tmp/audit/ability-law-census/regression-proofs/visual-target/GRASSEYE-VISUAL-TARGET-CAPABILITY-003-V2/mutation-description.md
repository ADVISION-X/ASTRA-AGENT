# GRASSEYE-VISUAL-TARGET-CAPABILITY-003-V2 Production Mutation

scenarioId: visual-target-missing-capability-call-id
mutationName: remove-capabilityCallId-from-input
mutatedFile: src/capabilities/visual-target/shared/visual-target-governance.ts
coveredLawIds: GRASSEYE-VISUAL-TARGET-CAPABILITY-003-V2
beforeHash: sha256:4af7f312a0907f978fae2c00bb5e1e2b5603bef808e83564e12574981c705759
afterMutationHash: sha256:3570b451ff67891042baf66fd1ec963075449b91edde728248f1889578206366

The mutation removes a required chain field from the governed input schema, proving Visual Target rejects incomplete chain-bearing inputs.
