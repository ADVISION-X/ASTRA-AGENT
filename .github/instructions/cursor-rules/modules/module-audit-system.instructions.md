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
- CI-FULL must execute only the governed foundation and ability owner steps declared in scripts/audit/core/ci-full-plan.ts.
- One capability domain maps to one owner manifest and one inspector entry.
- Generated artifacts must be rebuilt only by the CI-FULL audit-build stage through scripts/audit/build-audit-artifacts.ts.
- Enforcement authority belongs to CI-FULL orchestration plus owner-local real-code inspectors only.
- Topology and owner-cutover verdicts must close through owner-local inspector logic backed by AST, symbol resolution, or import-graph analysis for the decisive check.
- Public-index leakage, private-path escape, and legacy-contract escape must also close through decisive AST, symbol resolution, or import-graph checks.
- Per-child capability-check or verify files may be referenced only as forbidden-shape targets and must never become inspection substitutes.
- startup bootstrap checks are enforced by the commander-console-capability inspector as the startup child-contract checker and may not fall back to verify or smoke scripts.
- No standalone support governance domain exists in the current baseline. Active support sub-contracts remain enforced under their parent capability domain's owner manifest and inspector entry. If a future non-owner domain becomes independent enforcement truth for a controlled package architecture, it must provide manifest, inspector, required-shape, forbidden-shape, boundary-attack, anti-escape, and real-code-inspection coverage. Historical retired package-governance references remain retired only.

### 禁止

FORBIDDEN:
- scripts/verify, verify-* commands, ad-hoc quality scripts, or test files acting as capability enforcement truth.
- grep-only, regex-only, or includes-only checks acting as the final enforcement verdict for topology or owner-cutover disputes.
- Hand-editing generated artifacts or faking clean PASS summaries.
- Empty audit plans, missing owner manifests, or multi-owner capability domains.
- Compatibility, legacy, or bridge enforcement chains beside CI-FULL.
- A second complete quality gate entrypoint.
- Treating capability-check.ts, self-check, smoke-check, or child readiness helpers as accepted audit owners.
- retired package chain enforcement that stops at filename checks, string includes, or unparsed JSON scans.

## Law GRASSEYE-AUDIT-SIMPLE-GUARDRAIL-V1

status: active
tier: P0
capabilityDomain: audit-system
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: CI-FULL must protect only the current simple capability-machine mainline and must not preserve retired governance as active quality truth.

### 主题

质检只保护简单能力机器主线

### 法条

CI-FULL exists to block concrete regressions in the simple capability machine. It must not become a second runtime, second architecture model, or generated-matrix universe.

Required direction:
- CI-FULL verifies: UserRequirement, PlatformRegistry, MuscleMemoryCatalog, AI ability composition, Orchestration dispatch, capability-group atomic child execution, Geometry Guard, Forensics evidence.
- Every CI-FULL step must answer one clear blocking question.
- PASS output must stay short.
- FAIL output must name file, lawId, minimal reason, and fix direction.
- Generated artifacts are support evidence only, not authority truth.

### 禁止

FORBIDDEN:
- CI-FULL verifying or preserving map lifecycle, map binding drift, PAV lifecycle, semantic package legality, workflow legality, business-flow action packages, candidate approve/reject continuation, or fragmented AI judge refs as active quality truth.
- Building a second runtime model or second architecture model inside QA.
- Default inventory or report universes on PASS.
- Treating generated matrices, summaries, or inventories as authority truth.
- Using QA to keep retired map, package, workflow, or mandatory-PAV narratives alive.
- debug-loop, repair-packet, or archive-shadow inspection as active CI-FULL quality truth.

## Law GRASSEYE-AUDIT-NEW-MAINLINE-CI-FULL-V1

status: active
tier: P0
capabilityDomain: audit-system
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: active audit inspectors must not reference retired governance vocabulary as positive enforcement targets.

### 主题

执法脚本不得保存旧系统叙事

### 法条

Active audit inspector logic must reference only the current simple capability-machine mainline.

Required direction:
- Inspector logic may reference retired vocabulary only as forbidden regression tokens, never as positive enforcement targets.
- Retired token fragments must appear inside forbidden/negative checks only, never as required-shape assertions.
- One inspector answers one blocking question.
- If an inspector cannot be explained in one sentence, it must be split or deleted.
- If a report does not cause a blocking decision or a concrete repair path, it must be deleted.

### 禁止

FORBIDDEN:
- Active inspector code treating map prompt contracts, map binding drift, PAV lifecycle, or workflow packages as required positive shapes.
- Inspector emitting large reports by default when there are zero violations.
- Inspector referencing retired governance layers as positive enforcement truth.
- Active CI-FULL plan retaining retired map-layer owner steps as active quality gates.
