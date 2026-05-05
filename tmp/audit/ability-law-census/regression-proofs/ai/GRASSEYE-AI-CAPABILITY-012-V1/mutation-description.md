# GRASSEYE-AI-CAPABILITY-012-V1 Production Mutation

scenarioId: runtime-signal-mutation
mutationName: runtime signal mutation
mutatedFile: src/capabilities/ai/runtime/ai-runtime-call-runner.ts
coveredLawIds: GRASSEYE-AI-CAPABILITY-012-V1
beforeHash: sha256:4ab61f942987f29e3ce7a07066e3cbbcd57c202669e5070c2ad2f09c5be946ab
afterMutationHash: sha256:809836a6d68f02c67bcdd7941c24464ad3060836ed63a3196b0f771ab3f23973

The mutation drops AbortController signal propagation to the runtime port, proving AI timeout and cancellation are machine-enforced.
