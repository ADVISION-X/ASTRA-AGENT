# GRASSEYE-AI-CAPABILITY-012-V1 Production Mutation

scenarioId: runtime-signal-mutation
mutationName: runtime signal mutation
mutatedFile: src/capabilities/ai/runtime/ai-runtime-call-runner.ts
coveredLawIds: GRASSEYE-AI-CAPABILITY-012-V1
beforeHash: sha256:8d14e0a766f8b35cf9c269160ae1fb58d138cc16fce2157c9853a47793845d77
afterMutationHash: sha256:7c45c4284e7483bc04df530d60b63c577fe653c6d2e2caa4099b4131d9250531

The mutation drops AbortController signal propagation to the runtime port, proving AI timeout and cancellation are machine-enforced.
