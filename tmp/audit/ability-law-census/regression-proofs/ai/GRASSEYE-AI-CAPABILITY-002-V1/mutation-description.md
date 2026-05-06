# GRASSEYE-AI-CAPABILITY-002-V1 Production Mutation

scenarioId: ai-error-diagnostic-ref-mutation
mutationName: ai error diagnostic ref mutation
mutatedFile: src/capabilities/ai/ability-group.ts
coveredLawIds: GRASSEYE-AI-CAPABILITY-002-V1
beforeHash: sha256:c887845ec1f02c340932da5d8971c7b5caaea91573e7ad2037beb6cd3246fd20
afterMutationHash: sha256:a99b6e40dadd8c39ee51bd896b2529171eb5bb142852edb8191c4e96fdfd553b

The mutation removes diagnosticPayloadRef from unexpected AI child throw handling, proving outer runtime_execution_failed failures remain diagnosable.
