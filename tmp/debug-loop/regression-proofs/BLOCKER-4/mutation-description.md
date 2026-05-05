# BLOCKER-4 production mutation

Mutation: removed `runId: input.runId` from `buildOrchestrationProofIdentityFields` in `src/capabilities/orchestration/runtime/orchestration-proof-builder.ts`, causing runtime proof identity to omit the command runId.
