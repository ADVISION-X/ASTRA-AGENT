# GRASSEYE-MOUSE-SCROLL-CAPABILITY-002-V2 Production Mutation

scenarioId: mouse-scroll-final-action-log-mutation
mutationName: mouse-scroll-final-action-log mutation
mutatedFile: src/capabilities/mouse-scroll/runtime/mouse-scroll-result-builder.ts
coveredLawIds: GRASSEYE-MOUSE-SCROLL-CAPABILITY-002-V2, GRASSEYE-MOUSE-SCROLL-CAPABILITY-006-V2
beforeHash: sha256:4a585667fb2220878c306c3e2248b327736f3a0083d899385af8749a85fdaf3e
afterMutationHash: sha256:03859f1e3ef40b0ba154f317e5e90e9b2ef735612103b189170507b79c645bc7

The mutation leaks final action-log ownership into Mouse Scroll result building, proving Mouse Scroll cannot perform foreign-owner work.
