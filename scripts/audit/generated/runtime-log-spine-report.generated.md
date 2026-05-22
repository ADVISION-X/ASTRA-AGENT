# Runtime Log Spine Quality Report

Status: FAIL

## Summary

- Total findings: 2
- Fatal findings: 2
- Scanned files: 247
- Emit calls: 10
- Console violations: 0
- Failure events without class: 0
- Stage coverage: 100%

## Phases

| Phase | Status | Findings |
|---|---:|---:|
| forbidden-console | PASS | 0 |
| event-type-registry | PASS | 0 |
| runtime-log-emit-contract | FAIL | 2 |
| mode-visibility | PASS | 0 |
| stage-pair-coverage | PASS | 0 |
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
| GRASSEYE-RUNTIME-LOG-SPINE-003-V1 | src/plugins/deep-research-analysis/deep-research-analysis.logging.ts | 30 | RuntimeLogger.emit contract is incomplete | Add traceId, level, modeVisibility, eventType, owner and mission/run/round identifiers. Failed/review_required/skipped events must include failureClass contract. Spread fields must be statically proven. |
| GRASSEYE-RUNTIME-LOG-SPINE-017-V1 | src/plugins/deep-research-analysis/deep-research-analysis.logging.ts | 30 | eventType is not proven to come from RuntimeLogEventType registry | Import RuntimeLogEventType from the runtime log registry and use RuntimeLogEventType.X directly or through a traceable constant. |

## Coverage

Coverage is computed from AST/text contract checks for console policy, event registry usage, emit trace contracts, mode visibility, stage pairs, catch branches, failure classes, redaction, debug bundles, AI contracts, and browser action contracts.
