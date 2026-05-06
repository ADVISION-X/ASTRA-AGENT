# GRASSEYE-AI-CAPABILITY-002-V1 Production Mutation

scenarioId: ai-error-diagnostic-ref-mutation
mutationName: ai error diagnostic ref mutation
mutatedFile: src/capabilities/ai/ability-group.ts
coveredLawIds: GRASSEYE-AI-CAPABILITY-002-V1
beforeHash: sha256:bc2d85fb8843d959e0d23d26b200b8d0a3efa01b52ac59f17c254a6e54314a7c
afterMutationHash: sha256:242e76921eb34e2500b2fe23c547a5fa5ae09d503876aa45ed7e676dd94e82e1

The mutation removes diagnosticPayloadRef from unexpected AI child throw handling, proving outer runtime_execution_failed failures remain diagnosable.
