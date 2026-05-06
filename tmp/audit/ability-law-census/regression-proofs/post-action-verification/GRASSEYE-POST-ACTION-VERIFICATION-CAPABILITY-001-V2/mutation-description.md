# GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-001-V2 Production Mutation

scenarioId: contract-exposes-child-interface
mutationName: contract-exposes-child-interface
mutatedFile: src/capabilities/post-action-verification/contract.ts
coveredLawIds: GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-001-V2
beforeHash: sha256:a6808eda6af9b6fceb6121b13bfdf4dae83650767c4513ce3f4b6cd4f0502ba3
afterMutationHash: sha256:ccd7a23c7a7f57ff92c30b5700c3efb879b472271068a0cf31f0937a6560cf7f

The mutation exposes a child execute interface on the public contract, proving Post Action Verification must keep a thin public boundary and must not leak child/runtime entrypoints.
