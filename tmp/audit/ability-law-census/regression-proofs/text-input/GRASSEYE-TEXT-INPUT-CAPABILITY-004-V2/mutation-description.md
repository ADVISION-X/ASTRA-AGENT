# GRASSEYE-TEXT-INPUT-CAPABILITY-004-V2 Production Mutation

scenarioId: text-input-abort-signal-removed
mutationName: abort signal removal mutation
mutatedFile: src/capabilities/text-input/runtime/primitive-text-input-runner.ts
coveredLawIds: GRASSEYE-TEXT-INPUT-CAPABILITY-004-V2
beforeHash: sha256:a238484ee343d1b027b01fad1a0f2e564343281196d60eb288a2d8d1d3f6165a
afterMutationHash: sha256:4ac5454fc45d36da353a6bbb5f22f22639abfd4ef991f28d85c00b2fbacd003f

The mutation removes AbortSignal handoff from the primitive runner, proving Text Input execution must preserve governed timeout and cancellation enforcement.
