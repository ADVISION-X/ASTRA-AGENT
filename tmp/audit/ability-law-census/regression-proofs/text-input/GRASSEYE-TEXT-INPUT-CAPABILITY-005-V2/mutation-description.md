# GRASSEYE-TEXT-INPUT-CAPABILITY-005-V2 Production Mutation

scenarioId: text-input-raw-debug-leak
mutationName: raw text debug leak mutation
mutatedFile: src/capabilities/text-input/runtime/text-input-debug-events.ts
coveredLawIds: GRASSEYE-TEXT-INPUT-CAPABILITY-005-V2
beforeHash: sha256:7b061c48c974cc8763f5cb5eff9921828c35f54ad6a0ad96de860163209e179d
afterMutationHash: sha256:de3aacd81cc13810a343fb1c8966ee600035edd9e3130a63dbba6ce78652f421

The mutation leaks raw input text into the debug bundle, proving Text Input must keep sensitive text transient and redacted outside request scope.
