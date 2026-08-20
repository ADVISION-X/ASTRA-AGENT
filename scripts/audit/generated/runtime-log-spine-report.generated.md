# Runtime Log Spine Quality Report

Status: FAIL

## Summary

- Total findings: 1
- Fatal findings: 1
- Scanned files: 466
- Emit calls: 19
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
| catch-branch-log | PASS | 0 |
| failure-class | PASS | 0 |
| redaction | PASS | 0 |
| debug-bundle | PASS | 0 |
| ai-log-contract | PASS | 0 |
| browser-action-log-contract | FAIL | 1 |
| semantic-metrics-self-audit | PASS | 0 |
| anti-fake-inspector | PASS | 0 |

## Fatal Findings

| Law | File | Line | Message | Hint |
|---|---|---:|---|---|
| GRASSEYE-RUNTIME-LOG-SPINE-014-V1 | src/lib/browser/current-chrome-browser-action-logging.ts | 1 | BrowserController actions without caller correlation lack central production logging | The Current Chrome driver must centrally emit and persist one started/terminal pair for every uncorrelated browser or DOM action. Missing: workbench-browser:runtime-logger-injection, workbench-assembly:runtime-logger-wiring. |

## Coverage

Coverage is computed from AST/text contract checks for console policy, event registry usage, emit trace contracts, mode visibility, stage pairs, catch branches, failure classes, redaction, debug bundles, AI contracts, and browser action contracts.
