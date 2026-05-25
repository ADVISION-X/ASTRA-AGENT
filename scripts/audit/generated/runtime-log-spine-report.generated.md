# Runtime Log Spine Quality Report

Status: FAIL

## Summary

- Total findings: 1
- Fatal findings: 1
- Scanned files: 323
- Emit calls: 13
- Console violations: 0
- Failure events without class: 0
- Stage coverage: 100%

## Phases

| Phase | Status | Findings |
|---|---:|---:|
| forbidden-console | PASS | 0 |
| event-type-registry | PASS | 0 |
| runtime-log-emit-contract | PASS | 0 |
| mode-visibility | PASS | 0 |
| stage-pair-coverage | PASS | 0 |
| catch-branch-log | FAIL | 1 |
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
| GRASSEYE-RUNTIME-LOG-SPINE-004-V1 | src/plugins/deep-research-analysis/deep-research-analysis.html-report-reentry.ts | 89 | control-flow failure branch has no proven structured log | Add stage.fail/reviewRequired or RuntimeLogger.emit with failureClass before returning, throwing, skipping or terminating. |

## Coverage

Coverage is computed from AST/text contract checks for console policy, event registry usage, emit trace contracts, mode visibility, stage pairs, catch branches, failure classes, redaction, debug bundles, AI contracts, and browser action contracts.
