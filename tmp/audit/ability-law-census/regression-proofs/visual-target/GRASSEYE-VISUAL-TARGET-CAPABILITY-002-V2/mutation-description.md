# GRASSEYE-VISUAL-TARGET-CAPABILITY-002-V2 Production Mutation

scenarioId: visual-target-local-ai-import
mutationName: visual-target-local-ai-import
mutatedFile: src/capabilities/visual-target/runtime/local-ai-import-probe.ts
coveredLawIds: GRASSEYE-VISUAL-TARGET-CAPABILITY-002-V2
beforeHash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
afterMutationHash: sha256:75c9d90a1e43997bd282bd2c991682311ff9c964c821457c9a2c80c264ec759f

The mutation imports Local AI directly inside Visual Target runtime code, proving the boundary rejects foreign-owner execution surfaces.
