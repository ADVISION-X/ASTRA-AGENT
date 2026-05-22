# Runtime Log Spine Quality Report

Status: FAIL

## Summary

- Total findings: 11
- Fatal findings: 11
- Scanned files: 257
- Emit calls: 11
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
| catch-branch-log | FAIL | 10 |
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
| GRASSEYE-RUNTIME-LOG-SPINE-005-V1 | src/plugins/deep-research-analysis/deep-research-analysis.flow.ts | 354 | stage has no proven started/terminal pair | Create a stage handle with stageLogger.start and close every success, failure, skip, review_required and early return path. |
| GRASSEYE-RUNTIME-LOG-SPINE-004-V1 | src/plugins/deep-research-analysis/deep-research-analysis.flow.ts | 1093 | catch branch has no structured runtime log | Emit a failed/review_required event with failureClass, reason, stageName and recoveryPolicy before returning or throwing. |
| GRASSEYE-RUNTIME-LOG-SPINE-004-V1 | src/plugins/deep-research-analysis/deep-research-analysis.flow.ts | 529 | control-flow failure branch has no proven structured log | Add stage.fail/reviewRequired or RuntimeLogger.emit with failureClass before returning, throwing, skipping or terminating. |
| GRASSEYE-RUNTIME-LOG-SPINE-004-V1 | src/plugins/deep-research-analysis/deep-research-analysis.flow.ts | 546 | control-flow failure branch has no proven structured log | Add stage.fail/reviewRequired or RuntimeLogger.emit with failureClass before returning, throwing, skipping or terminating. |
| GRASSEYE-RUNTIME-LOG-SPINE-004-V1 | src/plugins/deep-research-analysis/deep-research-analysis.flow.ts | 712 | control-flow failure branch has no proven structured log | Add stage.fail/reviewRequired or RuntimeLogger.emit with failureClass before returning, throwing, skipping or terminating. |
| GRASSEYE-RUNTIME-LOG-SPINE-004-V1 | src/plugins/deep-research-analysis/deep-research-analysis.flow.ts | 721 | control-flow failure branch has no proven structured log | Add stage.fail/reviewRequired or RuntimeLogger.emit with failureClass before returning, throwing, skipping or terminating. |
| GRASSEYE-RUNTIME-LOG-SPINE-004-V1 | src/plugins/deep-research-analysis/deep-research-analysis.flow.ts | 932 | control-flow failure branch has no proven structured log | Add stage.fail/reviewRequired or RuntimeLogger.emit with failureClass before returning, throwing, skipping or terminating. |
| GRASSEYE-RUNTIME-LOG-SPINE-004-V1 | src/plugins/deep-research-analysis/deep-research-analysis.flow.ts | 1096 | control-flow failure branch has no proven structured log | Add stage.fail/reviewRequired or RuntimeLogger.emit with failureClass before returning, throwing, skipping or terminating. |
| GRASSEYE-RUNTIME-LOG-SPINE-004-V1 | src/plugins/deep-research-analysis/deep-research-analysis.flow.ts | 185 | control-flow failure branch has no proven structured log | Add stage.fail/reviewRequired or RuntimeLogger.emit with failureClass before returning, throwing, skipping or terminating. |
| GRASSEYE-RUNTIME-LOG-SPINE-004-V1 | src/plugins/deep-research-analysis/deep-research-analysis.flow.ts | 281 | control-flow failure branch has no proven structured log | Add stage.fail/reviewRequired or RuntimeLogger.emit with failureClass before returning, throwing, skipping or terminating. |
| GRASSEYE-RUNTIME-LOG-SPINE-004-V1 | src/plugins/deep-research-analysis/deep-research-analysis.flow.ts | 284 | control-flow failure branch has no proven structured log | Add stage.fail/reviewRequired or RuntimeLogger.emit with failureClass before returning, throwing, skipping or terminating. |

## Coverage

Coverage is computed from AST/text contract checks for console policy, event registry usage, emit trace contracts, mode visibility, stage pairs, catch branches, failure classes, redaction, debug bundles, AI contracts, and browser action contracts.
