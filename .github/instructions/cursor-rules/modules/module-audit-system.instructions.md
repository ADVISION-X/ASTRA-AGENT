---
name: "GrassEye Audit System"
description: "Use when defining law ownership, future inspector boundaries, audit report requirements, or generated-artifact handling for GrassEye governance."
applyTo: ".github/instructions/cursor-rules/modules/module-audit-system.instructions.md, scripts/audit/**"
---

# GrassEye Audit System

Scope: governs law ownership, owner manifests, generated audit artifacts, and CI-FULL connection truth.
Boundary: this module governs the minimum connection from current law files and blueprints to current real-code owner inspectors.
Excludes: business behavior, ability implementation details, and compatibility quality chains.
Authority: this file is authoritative only for the audit-system capability domain.

## Law GRASSEYE-AUDIT-SYSTEM-001-V1

status: active
tier: P0
capabilityDomain: audit-system
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: CI-FULL is the only complete quality gate and connects current law files, blueprints, manifests, and real-code inspectors.

### 主题

唯一 CI-FULL 质检链

### 法条

GrassEye enforcement must close through law files, owner manifests, generated registry and matrix artifacts, generated audit plans, CI-FULL owner steps, and real-code inspectors.

Required direction:
- Law files and owner manifests are human-maintained sources.
- law-registry.generated.json, enforcement-matrix.generated.json, enforcement-matrix.generated.yaml, audit-plan.generated.json, audit-conflicts.generated.json, touched-files.generated.json, code-purity outputs, and ci-full-summary.generated.json are machine-owned outputs.
- CI-FULL is the only complete quality gate.
- CI-FULL must execute only the governed foundation, map, and ability owner steps declared in scripts/audit/core/ci-full-plan.ts.
- One capability domain maps to one owner manifest and one inspector entry.
- Generated artifacts must be rebuilt only by the CI-FULL audit-build stage through scripts/audit/build-audit-artifacts.ts.
- Enforcement authority belongs to CI-FULL orchestration plus owner-local real-code inspectors only.
- Topology and owner-cutover verdicts must close through owner-local inspector logic backed by AST, symbol resolution, or import-graph analysis for the decisive check.
- Public-index leakage, private-path escape, and legacy-contract escape must also close through decisive AST, symbol resolution, or import-graph checks.
- Per-child capability-check or verify files may be referenced only as forbidden-shape targets and must never become inspection substitutes.
- startup bootstrap checks are enforced by the commander-console-capability inspector as the startup child-contract checker and may not fall back to verify or smoke scripts.
- governed non-owner domains such as map-plugin-package must still provide manifest, inspector, required-shape, forbidden-shape, boundary-attack, anti-escape, and real-code-inspection coverage when they become enforcement truth for a controlled package architecture.

### 禁止

FORBIDDEN:
- scripts/verify, verify-* commands, ad-hoc quality scripts, or test files acting as capability enforcement truth.
- grep-only, regex-only, or includes-only checks acting as the final enforcement verdict for topology or owner-cutover disputes.
- Hand-editing generated artifacts or faking clean PASS summaries.
- Empty audit plans, missing owner manifests, or multi-owner capability domains.
- Compatibility, legacy, or bridge enforcement chains beside CI-FULL.
- A second complete quality gate entrypoint.
- Treating capability-check.ts, self-check, smoke-check, or child readiness helpers as accepted audit owners.
- map-package enforcement that stops at filename checks, string includes, or unparsed JSON scans.

## Law GRASSEYE-AUDIT-SYSTEM-002-V1

status: active
tier: P0
capabilityDomain: audit-system
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Map Prompt Contract Governance must be enforced by AST, schema, and real-code-inspection.

### 主题

地图提示词契约必须真执法

### 法条

Map Prompt Contract Governance must be enforced by AST, schema, and real-code-inspection rather than documentation-only assertions.

## Law GRASSEYE-AUDIT-SYSTEM-003-V1

status: active
tier: P0
capabilityDomain: audit-system
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Prompt contract and map binding drift is audit-blocking.

### 主题

Prompt 绑定漂移必须拦截

### 法条

Prompt contract and map binding drift must be audit-blocking.
