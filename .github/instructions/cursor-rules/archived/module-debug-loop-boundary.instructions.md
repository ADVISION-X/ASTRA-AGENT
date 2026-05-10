---
name: "GrassEye Debug Loop Boundary"
description: "Use when governing debug-loop scripts, scenario runners, repair packet generation, log observers, auth/environment preflight, map-authoring debug harnesses, and the boundary that prevents debug-loop from becoming a second Agent, second Orchestration, second ability runtime, second Forensics writer, second map interpreter, or direct browser action executor."
applyTo: "scripts/debug-loop/**, docs/法案辅助文件/GrassEye Debug Loop Boundary 调试程序边界施工图.md, scripts/audit/domains/debug-loop-boundary/**, package.json"
---

# GrassEye Debug Loop Boundary

Scope: governs debug-loop scripts, scenario definitions, task publishers, log observers, repair packet writers, and preflight checks.
Boundary: debug-loop is local development tooling. It is not a production runtime owner, not Orchestration, not Nerve Bus, not Forensics, and not any action ability.
Authority: this law defines the red line between debug-loop as operator harness and debug-loop as second Agent.

Core doctrine:
- debug-loop replaces the human operator around the Agent.
- debug-loop must not replace the production Agent.
- debug-loop may publish through Commander and observe governed outputs only.
- debug-loop must not write legacy activation truth, legacy retired chain truth, or production proof.

## Law GRASSEYE-DEBUG-LOOP-BOUNDARY-001-V2

status: active
tier: P0
capabilityDomain: debug-loop-boundary
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: debug-loop may act only as operator harness and must not become a second runtime.

### 主题

调试程序身份边界

### 法条

Debug-loop may start a mission only through Commander public contract and may observe governed logs/events/proofs only.

Allowed:
- choose a scenario
- construct a human-like task request
- call Commander public contract
- observe runtime logs/events/proofs
- classify failure
- write repair packets
- run auth/environment preflight under explicit preflight mode

Forbidden:
- execute ability-group actions directly
- dispatch Nerve Bus mission action envelopes directly
- mutate mission state directly
- write legacy activation truth
- forge legacy activation truth
- write production evidence/proof truth
- interpret retired deterministic flow planning as runtime truth

## Final Readiness Gate

The debug-loop law is ready only when debug-loop remains a pure operator harness with no map truth, activation truth, or action-runtime truth.
