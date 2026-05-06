# GRASSEYE-AI-CAPABILITY-002-V1 Production Mutation

scenarioId: ai-error-diagnostic-ref-mutation
mutationName: ai error diagnostic ref mutation
mutatedFile: src/capabilities/ai/ability-group.ts
coveredLawIds: GRASSEYE-AI-CAPABILITY-002-V1
beforeHash: sha256:62fc52c5906895d4d9774f04d80b89c4b242f70d813511f9da020348cc1aae7c
afterMutationHash: sha256:3478fe202aab83565371c74328025dcb1cffe31b8f89f8c9774a47e34650aa5e

The mutation removes diagnosticPayloadRef from unexpected AI child throw handling, proving outer runtime_execution_failed failures remain diagnosable.
