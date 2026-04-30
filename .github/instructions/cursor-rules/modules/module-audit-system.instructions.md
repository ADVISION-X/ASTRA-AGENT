---
name: "GrassEye Audit System"
description: "Use when defining law ownership, future inspector boundaries, audit report requirements, or generated-artifact handling for GrassEye governance."
applyTo: ".github/instructions/cursor-rules/modules/module-audit-system.instructions.md, scripts/audit/**"
---

# GrassEye Audit System

Scope: governs law ownership, owner manifests, generated audit artifacts, and audit runner truth.
Boundary: this module governs enforcement ownership only.
Excludes: business behavior, ability implementation details, and compatibility quality chains.
Authority: this file is authoritative only for the audit-system capability domain.

## Law GRASSEYE-AUDIT-SYSTEM-001-V1

status: active
tier: P0
capabilityDomain: audit-system
enforcementMode: manual-first
evidenceMode: law

summary: inspector plus generated artifacts plus audit runner is the only enforcement chain.

### 主题

唯一执法链

### 法条

GrassEye enforcement must close through law files, owner manifests, generated registry and matrix artifacts, generated audit plans, domain inspectors, and the audit runner.

Required direction:
- Law files and owner manifests are human-maintained sources.
- law-registry.generated.json, enforcement-matrix.generated.json, enforcement-matrix.generated.yaml, audit-plan.generated.json, audit-conflicts.generated.json, and runner-summary.json are machine-owned outputs.
- The audit runner must execute only owners present in the generated audit plan.
- One capability domain maps to one owner manifest and one inspector entry.
- Generated artifacts must be rebuilt through scripts/audit/build-audit-artifacts.ts and scripts/audit/runner.ts rather than edited by hand.
- Enforcement authority belongs to inspector plus audit runner only.
- Topology and owner-cutover verdicts must close through inspector logic backed by AST, symbol resolution, or import-graph analysis for the decisive check.
- Public-index leakage, private-path escape, and legacy-contract escape must also close through decisive AST, symbol resolution, or import-graph checks.
- Per-child capability-check or verify files may be referenced only as forbidden-shape targets and must never become inspection substitutes.
- startup bootstrap checks are enforced by the commander-console-capability inspector as the startup child-contract checker and may not fall back to verify or smoke scripts.
- governed non-owner domains such as map-plugin-package must still provide manifest, inspector, required-shape, forbidden-shape, boundary-attack, anti-escape, negative-proof-harness, and scorecard-gate coverage when they become enforcement truth for a controlled package architecture.

### 禁止

FORBIDDEN:
- scripts/verify, verify-* commands, ad-hoc quality scripts, or test files acting as capability enforcement truth.
- grep-only, regex-only, or includes-only checks acting as the final enforcement verdict for topology or owner-cutover disputes.
- Hand-editing generated artifacts or faking clean PASS summaries.
- Empty audit plans, missing owner manifests, or multi-owner capability domains.
- Compatibility, legacy, or bridge enforcement chains beside the generated audit chain.
- Treating capability-check.ts, self-check, smoke-check, or child readiness helpers as accepted audit owners.
- map-package enforcement that stops at filename checks, string includes, or unparsed JSON scans.
