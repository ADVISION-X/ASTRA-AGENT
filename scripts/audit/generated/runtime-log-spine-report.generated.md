# Runtime Log Spine Quality Report

Status: FAIL

## Summary

- Total findings: 1
- Fatal findings: 1
- Scanned files: 289
- Emit calls: 12
- Console violations: 0
- Failure events without class: 0
- Stage coverage: 95%

## Phases

| Phase | Status | Findings |
|---|---:|---:|
| forbidden-console | PASS | 0 |
| event-type-registry | PASS | 0 |
| runtime-log-emit-contract | PASS | 0 |
| mode-visibility | PASS | 0 |
| stage-pair-coverage | FAIL | 1 |
| catch-branch-log | PASS | 0 |
| failure-class | PASS | 0 |
| redaction | PASS | 0 |
| debug-bundle | PASS | 0 |
| ai-log-contract | PASS | 0 |
| browser-action-log-contract | PASS | 0 |
| semantic-metrics-self-audit | PASS | 0 |
| anti-fake-inspector | PASS | 0 |

## Fatal Findings

| Law | File | Line | Message | Hint |
|---|---|---:|---|---|
| GRASSEYE-RUNTIME-LOG-SPINE-005-V1 | src/plugins/deep-research-analysis/deep-research-analysis.prompt-exchange-core.ts | 128 | stage has no proven started/terminal pair | Create a stage handle with stageLogger.start and close every success, failure, skip, review_required and early return path. |

## Coverage

Coverage is computed from AST/text contract checks for console policy, event registry usage, emit trace contracts, mode visibility, stage pairs, catch branches, failure classes, redaction, debug bundles, AI contracts, and browser action contracts.
