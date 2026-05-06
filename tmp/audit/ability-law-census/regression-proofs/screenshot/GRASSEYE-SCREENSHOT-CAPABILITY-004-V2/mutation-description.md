# GRASSEYE-SCREENSHOT-CAPABILITY-004-V2 Production Mutation

scenarioId: screenshot-non-success-output-escape
mutationName: non-success output escape mutation
mutatedFile: src/capabilities/screenshot/schema.ts
coveredLawIds: GRASSEYE-SCREENSHOT-CAPABILITY-004-V2
beforeHash: sha256:b969300df5f209167bb4dfaa85080ac73d3b0ac9b977a7a05c321832c7f152e4
afterMutationHash: sha256:eb998f65b87e566eee7943488630bde4e4851c6907b88985190419dbff51e3c6

The mutation weakens non-success output invariants in the schema, proving screenshot result/proof parity must fail closed when output truth drifts.
