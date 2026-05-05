# result nullable parity requiredness regression mutation

scenarioId: BLOCKER-POSTFIX-1/result-nullable-parity-requiredness
mutatedFile: src/capabilities/screenshot/screenshot-schema-refinements.ts
command: npm run audit:screenshot

Mutation:

- Change `validateResultChainFields` to require `SCREENSHOT_RESULT_CHAIN_FIELD_NAMES` instead of `SCREENSHOT_RESULT_REQUIRED_CHAIN_FIELD_NAMES`.
- Expected enforcement outcome: screenshot inspector fails because nullable parity-only fields are upgraded into result requiredness.
