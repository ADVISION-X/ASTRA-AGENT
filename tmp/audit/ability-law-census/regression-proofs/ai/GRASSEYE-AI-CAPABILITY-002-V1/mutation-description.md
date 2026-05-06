# GRASSEYE-AI-CAPABILITY-002-V1 Production Mutation

scenarioId: debug-event-wiring-mutation
mutationName: debug event wiring mutation
mutatedFile: src/capabilities/ai/runtime-factory.ts
coveredLawIds: GRASSEYE-AI-CAPABILITY-002-V1
beforeHash: sha256:e6d95550f2a0242b571720cab708c00d377e3c03a179234df8fe6d8191189384
afterMutationHash: sha256:959b26a07afa629837df8b8f24ebdd950d5a873d6a74b41a6c201132f75a50a8

The mutation removes emitDebugEvent from the configured runtime factory, proving AI_ERROR_DEBUG cannot silently disconnect from structured runtime logging.
