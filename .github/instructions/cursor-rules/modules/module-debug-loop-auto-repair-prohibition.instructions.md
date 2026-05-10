---
name: "Debug Loop Auto-Repair Prohibition"
description: "Prohibits automated repair-packet generation, automatic debug iterations, and codex-cli repair loops from being reintroduced into active code paths or CI. Use to block machine-triggered self-repair pipelines." 
applyTo: "scripts/**, src/**, package.json, .github/**"
---

# GRASSEYE-DEBUG-AUTO-REPAIR-001-V1

status: active
tier: P0
capabilityDomain: debug-loop-auto-repair-prohibition
enforcementMode: machine-blocking
evidenceMode: code-inspection

summary: Prevent reintroduction of automated repair-packet creation, automatic debug iteration loops, or codex-cli repair loops that can autonomously modify code or dispatch production actions.

Core rule:
- Automated generation of repair packets that are capable of being executed automatically is forbidden in production or CI-scanned code paths.
- Any automated loop (auto-iteration, auto-repair, codex-cli repair loop) which can programmatically dispatch commands, write activation/mission truth, or modify runtime state is forbidden.

Examples:
- Forbidden: `scripts/**/repair-packet.*`, `codex-cli repair-loop`, `autoDebugIteration()` implementations that dispatch commands without explicit operator confirmation.
- Allowed: tooling under `scripts/archived/` or developer-only local harnesses that are explicitly documented as archived/retired and not executed by CI.

Remediation: remove automated repair execution, convert to manual operator-driven flows, or move code to archived locations under `scripts/archived/` with clear retired status.
