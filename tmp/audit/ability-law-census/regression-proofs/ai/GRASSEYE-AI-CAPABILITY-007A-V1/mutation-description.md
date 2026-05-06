# GRASSEYE-AI-CAPABILITY-007A-V1 Production Mutation

scenarioId: ai-debug-trace-step-unsanctioned-stepid-mutation
mutationName: ai debug trace step unsanctioned stepId mutation
mutatedFile: src/lib/local-runtime/workbench-ai-debug-support.ts
coveredLawIds: GRASSEYE-AI-CAPABILITY-007A-V1
beforeHash: sha256:7b70291b53c42c1c39cd44daa32d6d4d9723ef147a595b6015958e4489553d9f
afterMutationHash: sha256:a7f6c4f7740ff73b5a63a5cff3b336f1cb6225cb2e8e0db9572ec4751ead20e2

The mutation reverts the AI debug trace step field to use input.stepId, which is an orchestration map step ID not in the RoundLifecycleStepSchema enum, causing StructuredRuntimeEventSchema.parse to throw at runtime and silently suppressing AI_REQUEST_DEBUG from the terminal observer. The proof chain inspector must catch this regression.
