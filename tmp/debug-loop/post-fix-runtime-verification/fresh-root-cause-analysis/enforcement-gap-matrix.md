# Fresh Enforcement Gap Matrix

| Blocker | Inspector | Negative proof | Coverage | Gap class | Next action |
|---|---|---|---|---|---|
| BLOCKER-POSTFIX-1 | `scripts/audit/domains/commander-console-capability/run-startup-readiness-gate-checks.ts` | `scripts/audit/domains/commander-console-capability/negative-proof-harness.ts` | Covers startup gate order, fail-closed throw, and governed readiness helper usage | J: runtime dependency unavailable, not a static enforcement miss | Bring Local AI runtime/models healthy, then rerun real restart and task trigger |
