# GRASSEYE-AI-CAPABILITY-002-V1 Production Mutation

scenarioId: ai-error-diagnostic-ref-mutation
mutationName: ai error diagnostic ref mutation
mutatedFile: src/capabilities/ai/ability-group.ts
coveredLawIds: GRASSEYE-AI-CAPABILITY-002-V1
beforeHash: sha256:b5fcf6cbf6d379c3a13ed682f6f62c1906c76c610f73258e210cdf24d84eed4b
afterMutationHash: sha256:d89aa8009438d12ee6b428570464a6fda8c2b2d77f0b31b574e07b92f12e4cc0

The mutation removes diagnosticPayloadRef from unexpected AI child throw handling, proving outer runtime_execution_failed failures remain diagnosable.
