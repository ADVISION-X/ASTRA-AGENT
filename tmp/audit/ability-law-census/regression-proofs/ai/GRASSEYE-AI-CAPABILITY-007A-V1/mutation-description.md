# GRASSEYE-AI-CAPABILITY-007A-V1 Production Mutation

scenarioId: ai-debug-trace-step-unsanctioned-stepid-mutation
mutationName: ai debug trace step unsanctioned stepId mutation
mutatedFile: src/lib/local-runtime/workbench-ai-debug-support.ts
coveredLawIds: GRASSEYE-AI-CAPABILITY-007A-V1
beforeHash: sha256:36e8d12e19f66a744e61cc8e9aa96a84d66820ac6772f559ec53b8aee820c2ee
afterMutationHash: sha256:e015cd53c6dd68c42ec6bb5ccafe1012ac016892c4f20514d42900ff73607f97

The mutation reverts the AI debug trace step field to use input.stepId, which is an orchestration map step ID not in the RoundLifecycleStepSchema enum, causing StructuredRuntimeEventSchema.parse to throw at runtime and silently suppressing AI_REQUEST_DEBUG from the terminal observer. The proof chain inspector must catch this regression.
