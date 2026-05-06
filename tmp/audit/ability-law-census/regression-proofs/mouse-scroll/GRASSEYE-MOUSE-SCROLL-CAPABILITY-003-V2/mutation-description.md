# GRASSEYE-MOUSE-SCROLL-CAPABILITY-003-V2 Production Mutation

scenarioId: result-output-null-guard-mutation
mutationName: result output null guard mutation
mutatedFile: src/capabilities/mouse-scroll/schema.ts
coveredLawIds: GRASSEYE-MOUSE-SCROLL-CAPABILITY-003-V2
beforeHash: sha256:eacd5042e227d041393d84b0d64505a6c0e549ab24c9cd5c1c50763687db4675
afterMutationHash: sha256:001b877046b00e6a39503c516460246ad22177edb14c1b4d1a59a8f832fcdabd

The mutation removes the schema-level output=null guard for failed and review_required results, proving Mouse Scroll schema must preserve its governed result invariants.
