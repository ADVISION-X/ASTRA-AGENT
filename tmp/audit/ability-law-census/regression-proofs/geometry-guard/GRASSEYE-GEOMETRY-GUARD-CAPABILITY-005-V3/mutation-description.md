# GRASSEYE-GEOMETRY-GUARD-CAPABILITY-005-V3 Production Mutation

scenarioId: child-returns-boolean
mutationName: child-returns-boolean
mutatedFile: src/capabilities/geometry-guard/children/validate-click-point/implementation.ts
coveredLawIds: GRASSEYE-GEOMETRY-GUARD-CAPABILITY-005-V3
beforeHash: sha256:a02b5c970420effe3233d55ee6a0cff67defbb78025072a5b654371187b1a9e9
afterMutationHash: sha256:e55b1fb0e70fda4a24cc84ecfbb82c23877a63bb7bcaf5c88d6022be3075f381

The mutation bypasses the shared child pipeline by returning a boolean from a child implementation, proving Geometry Guard children must remain thin delegates into the governed executor.
