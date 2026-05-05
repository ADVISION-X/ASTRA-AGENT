# GRASSEYE-AI-CAPABILITY-011-V1 Production Mutation

scenarioId: prompt-registry-throw-mutation
mutationName: prompt registry throw mutation
mutatedFile: src/capabilities/ai/runtime/ai-prompt-registry.ts
coveredLawIds: GRASSEYE-AI-CAPABILITY-011-V1
beforeHash: sha256:b3fc376de144851b406a92fe99d497dea3934e4469840b72b6f501976715015a
afterMutationHash: sha256:0b352f1e4ac94fcfd302687cc69a4f94d0bbd943ff80fe3996215220e619c997

The mutation changes typed prompt resolution failure into a throw, proving prompt execution must route through governed typed failures.
