# GRASSEYE-SCREENSHOT-CAPABILITY-005-V2 Production Mutation

scenarioId: screenshot-timeout-truth-bypass
mutationName: timeout truth bypass mutation
mutatedFile: src/capabilities/screenshot/runtime/screenshot-execution-phase-helpers.ts
coveredLawIds: GRASSEYE-SCREENSHOT-CAPABILITY-005-V2
beforeHash: sha256:b970e4cfae370759f8d60e7f0f7b9b80df921d22c4286dc78ecb69800d2b19ac
afterMutationHash: sha256:1fd1a323de549cbe5691c6c862b7e3672199ee7b41ee7e5b818b9ffb8ebc8e53

The mutation bypasses governed timeout resolution, proving screenshot timeout truth must route through the shared resolveScreenshotTimeoutMs helper.
