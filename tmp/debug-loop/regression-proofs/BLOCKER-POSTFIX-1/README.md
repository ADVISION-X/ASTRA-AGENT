# BLOCKER-POSTFIX-1 Regression Proofs

This directory records real production-code mutation verification for the screenshot owner nullable `videoVisitId` blocker.

Executed command for every scenario:

```txt
npm run audit:screenshot
```

Recorded scenarios:

1. `videoVisitId-requiredness`
2. `result-nullable-parity-requiredness`

Acceptance rule:

- Mutated production file must make `audit:screenshot` fail.
- Rolling back the same file must restore `audit:screenshot` pass.
