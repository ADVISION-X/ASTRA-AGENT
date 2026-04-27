---
name: "GrassEye Code Topology"
description: "Use when creating, moving, or naming GrassEye files, defining domain ownership, or checking canonical repository paths."
applyTo: ".github/instructions/cursor-rules/modules/module-code-topology.instructions.md"
---

# GrassEye Code Topology

Scope: governs canonical path ownership for phase-one GrassEye code and audit assets.
Boundary: this module governs file placement and domain ownership only.
Excludes: business logic, runtime policy, scoring rules, and type-validation semantics.
Authority: this file is authoritative only for the code-topology capability domain.

---

## Law GRASSEYE-CODE-TOPOLOGY-001-V1

status: active
tier: P0
capabilityDomain: code-topology
enforcementMode: manual-first
evidenceMode: law

summary: phase-one code must land in explicit domain paths and may not create root buckets or future-capability folders.

### 主题

目录归属与路径单一性

### 法条

GrassEye phase-one code paths must stay explicit: src/app for route entry, src/features/<domain> for feature logic, src/lib for shared infrastructure, src/types for cross-domain types, scripts/audit for audit scripts, and .github/instructions/cursor-rules for laws.

Required direction:
- Route entry belongs in src/app.
- Domain logic belongs in src/features/agent, vision, platform-action, comments, product-signal, local-data, or operator-control.
- Platform adapters belong under src/features/platform-action/adapters when implemented.
- Browser automation infrastructure belongs under src/lib/browser only when it remains domain-neutral infrastructure.
- Browser profile metadata helpers belong under src/lib/browser or src/lib/local-runtime.
- Visible browser control, OS input primitives, and screen capture helpers belong under src/lib/browser.
- Local AI gateway, model-role routing, and prompt registry surfaces belong under src/lib/local-ai when implemented.
- Governed local model configuration belongs under config/local-ai.models.json.
- Local model config loading belongs under src/lib/local-ai.
- Local AI model names and provider selection must not be scattered across feature domains.
- Localization dictionaries, locale parsing, and text rendering helpers belong under src/lib/localization.
- Feature-owned UI may consume localization helpers but must not own global localization dictionaries.
- Local runtime shell surfaces, when implemented, must keep operator UI, agent runtime, browser infrastructure, local-AI boundary, and local-data ownership in their canonical domains.
- Localization audit owner belongs under scripts/audit/domains/localization.
- Local startup entrypoints belong under scripts/startup.
- Startup helper files belong under scripts/startup/lib.
- Startup scripts must delegate dependency checking, process control, health check, and page opening to narrow helpers rather than becoming a mixed bucket.
- Packaging-specific files must not become business-domain owners.
- Domain-specific AI result contracts may stay under the owning feature contract until they prove cross-domain use.
- Platform-specific page knowledge must not leak into agent-runtime, vision, comments, product-signal, or local-data domains.
- Vision-coordinate action policy, geometry guards, and visual-target contracts belong under src/features/platform-action.
- Local persistence schema types belong under src/types/local-persistence.ts.
- Persistence implementation belongs under src/features/local-data or src/lib/storage.
- Shared infrastructure belongs in src/lib only when it is truly cross-domain.
- Cross-domain types belong in src/types, and audit scripts belong in scripts/audit.

### 禁止

FORBIDDEN:
- Root-level buckets with mixed ownership.
- Dumping business logic into src/lib.
- Moving domain-private types into src/types too early.
- Prompt strings scattered inside unrelated feature files.
- Scattering global UI dictionaries inside route handlers or feature components.
- Creating ad hoc localization folders under unrelated feature domains.
- Placing localization runtime helpers inside startup scripts, platform adapters, local AI, or data-store domains.
- Hardcoded model names inside agent-runtime, platform-action, operator-control, product-signal, or server route files.
- Creating ad hoc model config files outside config/ without code-topology review.
- Local model calls hidden inside UI, platform adapter, or product-signal helpers without the local-AI boundary.
- Creating Electron, Tauri, SwiftUI, or desktop-shell folders that duplicate agent-runtime, platform-action, local-AI, or local-data ownership.
- Placing browser automation, AI calls, or data-store truth directly inside UI route files.
- Platform-specific selectors or click recipes inside agent-runtime or product-signal.
- Raw coordinate recipes inside agent-runtime, local-ai, product-signal, or operator-control.
- OS input primitives inside feature domains outside platform-action/browser infrastructure.
- Turning src/lib/browser into a product-research orchestration owner.
- Creating crawler, scraper, dom-reader, page-parser, or selector-engine folders for real-platform mode.
- Root-level startup scripts such as start.sh, run.sh, or fix-and-start.sh as long-term source truth.
- Startup scripts placed inside feature domains.
- Startup scripts that mix dependency management, business orchestration, AI reasoning, platform clicking, and data repair in one file.
- Repository test roots such as tests, __tests__, or *.test.* files as source truth.
- Creating separate platform root buckets such as src/facebook, src/tiktok, or src/social.
- Creating future-capability directories such as ads, procurement, supplier, CRM, or account systems.

---

## Law GRASSEYE-CODE-TOPOLOGY-002-V1

status: active
tier: P0
capabilityDomain: code-topology
enforcementMode: manual-first
evidenceMode: law

summary: long-horizon phase artifacts must use canonical documentation paths and may not turn root or docs into mixed garbage buckets.

### 主题

长期阶段文件与文档目录归属

### 法条

GrassEye long-horizon phase artifacts must land in canonical documentation paths so phase goals, TODO plans, Codex prompts, blueprints, acceptance reports, and archived materials stay separable, reviewable, and non-authoritative unless explicitly routed by the current phase.

Required direction:
- Phase goal documents belong under docs/阶段目标.
- Phase TODO plans belong under docs/TODO.
- Codex execution prompts belong under docs/Codex提示词.
- Law blueprints belong under docs/法案辅助文件.
- Acceptance or completion reports belong under docs/验收报告.
- Historical or inactive phase materials belong under docs/归档 or must carry an explicit archived or inactive marker until moved.
- Root-level phase artifacts must be reduced to canonical documentation paths instead of creating scattered working files.
- Runtime local data, screenshots, OCR output, browser sessions, model cache, and evidence databases must stay outside repository source truth; development-only local data paths such as .grasseye-local are valid only when gitignored.
- Runtime browser profiles belong under .grasseye-local/browser-profiles and must be gitignored.
- Runtime data root .grasseye-local must not be committed.

### 禁止

FORBIDDEN:
- Root-level scattered TODO, prompt, report, or phase-plan files.
- Mixing phase goals, TODO plans, prompts, blueprints, and reports in one untyped docs bucket.
- Treating old phase files as current authority without a current-phase marker or archive status.
- Committing local runtime screenshots, OCR dumps, browser sessions, cookies, model cache, or evidence databases as source files.
- Committing browser profile directories or profile contents as source files.
- Creating ad hoc documentation roots outside the canonical documentation paths.

---

## 模块边界声明

This law file does not govern:
- How a domain behaves at runtime.
- How external input is validated or typed.
- The content of phase goals or TODO items.
- The business priority of a phase.
- The implementation details of runtime local storage.