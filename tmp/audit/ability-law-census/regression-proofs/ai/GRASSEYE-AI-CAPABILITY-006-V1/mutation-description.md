# GRASSEYE-AI-CAPABILITY-006-V1 Production Mutation

scenarioId: as-any-mutation
mutationName: as-any mutation
mutatedFile: src/capabilities/ai/runtime/ai-executor.ts
coveredLawIds: GRASSEYE-AI-CAPABILITY-006-V1
beforeHash: sha256:f6c342220ff5e82447b768da0adf75175a28d22a41469d6889065fae1788da12
afterMutationHash: sha256:9fda9af86c5a7122c47ba99a6a913a22deaeccaeffb3402663ccdc127e26f5be

The mutation injects an any escape into AI runtime code, proving the AI public/private boundary cannot be bypassed with type escapes.
