# GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-004-V2 Production Mutation

scenarioId: external-imports-runtime-path
mutationName: external-imports-runtime-path
mutatedFile: src/lib/local-runtime/workbench-post-action-runtime.ts
coveredLawIds: GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-004-V2
beforeHash: sha256:ff639a2c67ff8f6bf9fe64229b2355b3ff69bb52463b79820a83b406f6472110
afterMutationHash: sha256:c6f19b579b14ecd2b1e8f4d8b6466cd3f6258a0af1c4fd18b8729ca4cc6d9be9

The mutation makes external local-runtime code import a private post-action runtime path, proving Post Action Verification must keep runtime internals private and shape-closed to outside owners.
