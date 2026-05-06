# GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-008-V2 Production Mutation

scenarioId: negative-proof-invocation-removed
mutationName: negative-proof-invocation-removed
mutatedFile: scripts/audit/domains/post-action-verification-capability/inspector.ts
coveredLawIds: GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-008-V2
beforeHash: sha256:e4fe2c970e4b814d7d3dcb096eedc989cb9b666f349ae7fff7a6ee2dbcc1a69e
afterMutationHash: sha256:e70d36931ad791c205624b022517255764b94c77af29f3ad2ada5f72ab375fe4

The mutation removes nested guarded negative-proof invocation from the inspector, proving PAV enforcement must close through the owner-local inspector, runner, and negative-proof harness.
