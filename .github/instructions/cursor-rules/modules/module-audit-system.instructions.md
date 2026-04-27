---
name: "GrassEye Audit System"
description: "Use when defining law ownership, future inspector boundaries, audit report requirements, or generated-artifact handling for GrassEye governance."
applyTo: ".github/instructions/cursor-rules/modules/module-audit-system.instructions.md, scripts/audit/**"
---

# GrassEye Audit System

Scope: governs law ownership, future inspector boundaries, and audit reporting truth.
Boundary: this module governs governance and audit ownership only.
Excludes: business logic, browser runtime design, and fake automated enforcement claims.
Authority: this file is authoritative only for the audit-system capability domain.

---

## Law GRASSEYE-AUDIT-SYSTEM-001-V1

status: active
tier: P0
capabilityDomain: audit-system
enforcementMode: manual-first
evidenceMode: law

summary: phase-one audit law defines ownership boundaries now so future enforcement can be real rather than ceremonial.

### 主题

法案 owner 与审计报告闭环

### 法条

GrassEye audit governance must keep one law home, one capability-domain owner, and a report format that exposes real change impact.

Required direction:
- Law home is .github/instructions/cursor-rules, and one capability domain maps to one owner boundary.
- Law files and owner manifests are human-maintained, while generated artifacts must be built from those sources rather than hand-maintained as runtime truth.
- Future inspectors must inherit one domain each rather than cross-domain sprawl.
- Runner execution must consume a generated audit plan, and phase gates must define the active execution window.
- Blueprint-backed platform-adapter enforcement, when introduced later, must verify both law anchors and the matching blueprint matrix anchors.
- Future platform-action enforcement must verify coordinate actions have visual target evidence, geometry guard, post-action verification, and no stealth/anti-detection code.
- Future local-AI enforcement must verify local execution posture, prompt registry boundaries, local model role configuration, role completeness, provider restrictions, and absence of hidden paid or cloud AI fallback.
- Future local-app-shell enforcement must verify non-SaaS posture, local service boundary, and absence of packaging-layer business ownership.
- Future localization enforcement must verify dictionary completeness, language-switch availability, and absence of hardcoded operator-facing UI copy in governed workbench surfaces.
- Future startup enforcement must verify startup script placement, bounded responsibilities, absence of business-domain ownership, and clear health-gated launch behavior.
- Future code-purity enforcement must verify file length, function length, nesting depth, complexity, mixed-owner files, dead code, commented-out implementation code, debug leftovers, TODO hygiene, and compatibility-bridge drift.
- Future evidence-packet enforcement must verify packet schema presence, Browse Ledger vs Evidence Packet distinction, actionPurpose presence, dataQualityFlags presence, candidate pending_analysis status, absence of high-level business conclusions inside packets, product_no not creating full packet by default, advanced-AI export sets containing Evidence Packets only by default, and session summaries exposing total seen count and packet count.
- Future local-browser-session enforcement must verify real Chrome persistent profile usage, no temporary context acceptance, no cookie export or import, no headless default, and no committed profile directory.
- Future local-persistence-schema enforcement must verify schema tables, evidence file store layout, gitignore, no scattered JSON truth, and no cookies/session/token persistence.
- Future structured-logging enforcement must verify structured log law, runtime event schema, action log schema, required event sequence, and no console-log truth path.
- Future visual-action-capability enforcement must verify target catalog, boundingBox contracts, geometry guard, post-action verification, and no hidden DOM primary path.
- Future visual-only-runtime enforcement must verify no DOM content reading, no selector-based action acceptance, no hidden DOM fallback, and browser infrastructure stays limited to launch/navigation/screenshot/geometry/coordinate input.
- Future multi-frame-evidence enforcement must verify sample times, contact sheet preference, one AI task default, validFrameCount rules, and no single-opening-frame default.
- Audit enforcement is the only quality gate authority for GrassEye; repository test files and npm test must not be treated as release truth.
- Future audit enforcement must fail when repository test files, tests directories, or npm test-based verification paths are present.
- Future topology enforcement must verify canonical placement of phase goals, TODO plans, Codex prompts, law blueprints, acceptance reports, archives, and exclusion of runtime local data from repository truth.
- Generated artifacts must remain machine-owned and not be hand-edited.
- Audit reports must state modified files, new files, unfinished items, law impact, enforcement impact, risks, and next-round suggestions.

### 禁止

FORBIDDEN:
- Blind delegate patterns without a real owner.
- Hand-maintaining runtime enforcement matrices, runner order, or law-to-inspector bindings as execution truth.
- Pretending string scans are the same as AST enforcement.
- One inspector owning multiple unrelated capability domains.
- Claiming real-platform action governance is enforced while ignoring raw coordinate scatter, selector scatter, or stealth/fingerprint/captcha bypass patterns.
- Claiming platform-adapter governance is enforced while ignoring the platform adaptation blueprint.
- Claiming local-AI governance is enforced without checking prompt registry, model config completeness, cloud provider config, or hidden heuristic/mock execution boundaries.
- Claiming local-app-shell governance is enforced while ignoring SaaS drift, public exposure, or packaging-layer ownership duplication.
- Claiming localization governance is enforced while ignoring missing locale keys, English-only UI, Chinese-only UI, or scattered UI copy.
- Claiming startup governance is enforced while ignoring startup scripts that mutate laws, generated artifacts, business code, or runtime evidence.
- Claiming code-purity governance is enforced while ignoring oversized files, giant functions, mixed owner files, dead code, debug leftovers, or compatibility bridges.
- Treating test files, mocks, or npm test output as a parallel quality authority beside the audit system.
- Claiming topology governance is enforced while ignoring scattered root-level phase artifacts or committed runtime local data.
- Hand-editing generated artifacts or writing fake PASS results.

---

## 模块边界声明

This law file does not govern:
- How business features should behave.
- How evidence records are stored or typed.