# GRASSEYE-AI-CAPABILITY-006-V1 Production Mutation

scenarioId: as-any-mutation
mutationName: as-any mutation
mutatedFile: src/capabilities/ai/runtime/ai-executor.ts
coveredLawIds: GRASSEYE-AI-CAPABILITY-006-V1
beforeHash: sha256:38f69a2d31c7855a2d0721a75e756effda85269ec6d77a1cf47b0327701fee2b
afterMutationHash: sha256:54e7229c8708e9648a058b9e6e508ef23e3bdc25d3160e5aaa56cd4eda73f93c

The mutation injects an any escape into AI runtime code, proving the AI public/private boundary cannot be bypassed with type escapes.
