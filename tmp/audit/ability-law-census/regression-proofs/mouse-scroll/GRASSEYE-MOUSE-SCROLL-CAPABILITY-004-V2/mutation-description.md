# GRASSEYE-MOUSE-SCROLL-CAPABILITY-004-V2 Production Mutation

scenarioId: scroll-until-found-loop-mutation
mutationName: scroll-until-found loop mutation
mutatedFile: src/capabilities/mouse-scroll/runtime/mouse-scroll-executor.ts
coveredLawIds: GRASSEYE-MOUSE-SCROLL-CAPABILITY-004-V2
beforeHash: sha256:eb9b84b95cba0581559e3b10914041dd7a9e7c2b1a6228e04aecdffb7b4bc5a8
afterMutationHash: sha256:2ca20a8fee44c78a51b1e8ba0d4a88483558ea77c2061bb5975ab28dee1e17fc

The mutation introduces a hidden until-found loop, proving direction, magnitude, and repeat must stay explicit input or policy rather than hidden runtime behavior.
