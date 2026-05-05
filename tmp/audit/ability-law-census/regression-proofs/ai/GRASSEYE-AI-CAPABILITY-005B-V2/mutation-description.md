# GRASSEYE-AI-CAPABILITY-005B-V2 Production Mutation

scenarioId: forbidden-action-output-mutation
mutationName: forbidden action output mutation
mutatedFile: src/capabilities/ai/runtime/ai-output-boundary-gate.ts
coveredLawIds: GRASSEYE-AI-CAPABILITY-005B-V2, GRASSEYE-AI-CAPABILITY-014-V1
beforeHash: sha256:af76bc56b892367a80d0808d6ca2cbce8e50a58e73a9049a7ebbebeb061b6b0b
afterMutationHash: sha256:194b02461235e542fa19fc4b3c12aa3350a7783bc09280225a67dbbd59effbfd

The mutation disables forbidden output-key enforcement before Forensics persistence, proving AI output must be cleaned before persistence.
