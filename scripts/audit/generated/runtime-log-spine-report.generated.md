# Runtime Log Spine Quality Report

Status: FAIL

## Summary

- Total findings: 2
- Fatal findings: 2
- Scanned files: 428
- Emit calls: 19
- Console violations: 2
- Failure events without class: 0
- Stage coverage: 100%

## Phases

| Phase | Status | Findings |
|---|---:|---:|
| forbidden-console | FAIL | 2 |
| event-type-registry | PASS | 0 |
| runtime-log-emit-contract | PASS | 0 |
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
| GRASSEYE-RUNTIME-LOG-SPINE-001-V1 | src/capabilities/video-download/acceptance/browser-authority.acceptance.ts | 42 | console escape detected by AST/symbol inspector | Replace console usage or alias with RuntimeLogger.emit / authorized stage logger. Console aliases and destructuring are forbidden. |
| GRASSEYE-RUNTIME-LOG-SPINE-001-V1 | src/lib/browser/release/release-identity.acceptance.ts | 51 | console escape detected by AST/symbol inspector | Replace console usage or alias with RuntimeLogger.emit / authorized stage logger. Console aliases and destructuring are forbidden. |

## Coverage

Coverage is computed from AST/text contract checks for console policy, event registry usage, emit trace contracts, mode visibility, stage pairs, catch branches, failure classes, redaction, debug bundles, AI contracts, and browser action contracts.
