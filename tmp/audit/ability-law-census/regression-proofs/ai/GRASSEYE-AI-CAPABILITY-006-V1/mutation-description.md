# GRASSEYE-AI-CAPABILITY-006-V1 Production Mutation

scenarioId: as-any-mutation
mutationName: as-any mutation
mutatedFile: src/capabilities/ai/runtime/ai-executor.ts
coveredLawIds: GRASSEYE-AI-CAPABILITY-006-V1
beforeHash: sha256:64beeb5a02ca548647af46aadd0ea2ccdaa029ab43409fff53ac36d5ec53ab26
afterMutationHash: sha256:ff89f99bf5a463bab83b82cfb9a3e5653c73181154b2bbb103eec24ce851b8a2

The mutation injects an any escape into AI runtime code, proving the AI public/private boundary cannot be bypassed with type escapes.
