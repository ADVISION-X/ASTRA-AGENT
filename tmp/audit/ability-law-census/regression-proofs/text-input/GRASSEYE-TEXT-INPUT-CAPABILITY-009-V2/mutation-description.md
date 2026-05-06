# GRASSEYE-TEXT-INPUT-CAPABILITY-009-V2 Production Mutation

scenarioId: text-input-negative-proof-invocation-removed
mutationName: negative proof invocation removed mutation
mutatedFile: scripts/audit/domains/text-input-capability/inspector.ts
coveredLawIds: GRASSEYE-TEXT-INPUT-CAPABILITY-009-V2
beforeHash: sha256:d7dba98584370e85d516895754c129134738814225bad917754089a7d2b96228
afterMutationHash: sha256:5aeada6eef7ba7d54fafcd3e2975a17d2bf631d93c357fe0b9ea31c285221b68

The mutation disconnects the Text Input inspector from its negative-proof harness, proving enforcement must close through the owner-local inspector plus negative-proof chain.
