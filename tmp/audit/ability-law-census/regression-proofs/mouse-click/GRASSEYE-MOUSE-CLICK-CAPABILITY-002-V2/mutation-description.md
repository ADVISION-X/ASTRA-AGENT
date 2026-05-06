# GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V2 Production Mutation

scenarioId: mouse-click-final-action-log-mutation
mutationName: mouse-click-final-action-log mutation
mutatedFile: src/capabilities/mouse-click/runtime/mouse-click-result-builder.ts
coveredLawIds: GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V2, GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V2
beforeHash: sha256:9eadcba7d82a743f70268376a2bc9aad96eb2a2c0e8afeb3453fbae0e5f6caaa
afterMutationHash: sha256:d7f347e63b05debcaaf1d12b358a5cec3525f07766646c5e6b8a526443b9bb20

The mutation leaks final action-log ownership into Mouse Click result building, proving Mouse Click cannot perform foreign-owner work.
