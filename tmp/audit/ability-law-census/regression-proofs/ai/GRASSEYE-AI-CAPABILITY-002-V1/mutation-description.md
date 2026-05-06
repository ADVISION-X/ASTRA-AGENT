# GRASSEYE-AI-CAPABILITY-002-V1 Production Mutation

scenarioId: ai-error-diagnostic-ref-mutation
mutationName: ai error diagnostic ref mutation
mutatedFile: src/capabilities/ai/ability-group.ts
coveredLawIds: GRASSEYE-AI-CAPABILITY-002-V1
beforeHash: sha256:d5ddc103a0966e425fcc28413c21bfb32439e57cd8b4ca85d21ca4f04eded512
afterMutationHash: sha256:8796e66d902d12b688ea1eabd6ed5eccd68a385ece6b588c1a94ddf2697095c4

The mutation removes diagnosticPayloadRef from unexpected AI child throw handling, proving outer runtime_execution_failed failures remain diagnosable.
