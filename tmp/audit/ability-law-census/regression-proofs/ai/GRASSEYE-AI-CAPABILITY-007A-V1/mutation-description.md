# GRASSEYE-AI-CAPABILITY-007A-V1 Production Mutation

scenarioId: ai-debug-trace-step-unsanctioned-stepid-mutation
mutationName: ai debug trace step unsanctioned stepId mutation
mutatedFile: src/lib/local-runtime/workbench-ai-debug-support.ts
coveredLawIds: GRASSEYE-AI-CAPABILITY-007A-V1
beforeHash: sha256:118731f6b770fae2d1a304108a91879ef40c8368d3a3becbe3fcc7681447a80d
afterMutationHash: sha256:7e35935ab4261438c70bcdba7b3f851cd253b31b537ab15cb5e4fc15aac592bb

The mutation reverts the AI debug trace step field to use input.stepId, which is an orchestration map step ID not in the RoundLifecycleStepSchema enum, causing StructuredRuntimeEventSchema.parse to throw at runtime and silently suppressing AI_REQUEST_DEBUG from the terminal observer. The proof chain inspector must catch this regression.
