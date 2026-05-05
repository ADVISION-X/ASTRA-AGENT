# videoVisitId requiredness regression mutation

scenarioId: BLOCKER-POSTFIX-1/videoVisitId-requiredness
mutatedFile: src/capabilities/screenshot/shared/screenshot-governance.ts
command: npm run audit:screenshot

Mutation:

- Move `videoVisitId` into `SCREENSHOT_PROOF_REQUIRED_CHAIN_FIELD_NAMES`.
- Expected enforcement outcome: screenshot inspector fails before negative-proof baseline because the governance required-chain contract drifts away from nullable `videoVisitId` truth.
