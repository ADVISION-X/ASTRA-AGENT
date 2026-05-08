---
name: "GrassEye Index"
description: "Use when routing GrassEye phase-five final-delivery debugging work to the correct module law, checking always-loaded governance files, or reviewing narrow path triggers."
applyTo: ".github/instructions/cursor-rules/**"
---

# GrassEye Index

Role: locate active GrassEye laws for the current repository only.
Boundary: this file routes; it does not define business rules or replace a module owner.
Excludes: module law content, implementation plans, future inactive capabilities, and duplicated kernel text.
Authority: this file is authoritative only for GrassEye law routing.
Current routing phase: phase-five final-delivery debugging.

---

## Always Loaded Files

- GRASSEYE-KERNEL.instructions.md
- grasseye-index.instructions.md

Kernel loads first.
Index only locates the narrowest current authority.

---

## Routing Rules

- Load GRASSEYE-KERNEL before any module match.
- Load module-capability-group-governance when the task defines ability groups, child abilities, shared contracts, currentStrength, forbiddenResponsibilities, or debug runtime proof.
- Index may route only to the 14 active ability groups, foundation laws, and explicit support-governance domains.
- Match the narrowest domain by path and task keywords.
- Deleted historical owner names may appear only as remap triggers to a current owner; they must never route to absent modules.
- Do not activate absent historical paths.
- Do not use broad patterns to revive future capabilities.
- When two modules appear close, choose the one that directly owns the decision or record boundary.

Support-governance domains:
- map-plugin-package routes as support governance, not as an active ability group.

Local development tooling:
- debug-loop-controller stays outside active law routing and must not be revived as an active ability group.

---

## Active Module Routes

| Path or trigger | Load module | Routing note |
| -- | -- | -- |
| commander console, human command, mission dashboard, runtime proof timeline, review queue, audit summary, manual override, candidate pool, operator review | module-commander-console-capability.instructions.md | Human entry and console reads only |
| ability group, child ability, shared ability contract, currentStrength, debug proof contract, forbidden responsibilities, orchestration matrix, capability catalog, catalog generated from abilities | module-capability-group-governance.instructions.md | Shared ability-group governance only |
| orchestration ability group, mission state, mission command execution, operational map, map registry, step state, branch, runtime loop, observe, classify, act, record, orchestrator, facebook-product-discovery-map, tiktok-product-discovery-map, branch after AI output | module-orchestration-capability.instructions.md | Legacy runtime-loop vocabulary remaps to Orchestration mission-map authority |
| map plugin, map package, operational map package, task template package, map import, map activation, map rollback, map quarantine, map compatibility, map validator, AI draft map, map step, prompt binding, map-driven prompt, map authoring prompt builder, AI-generated map prompt | module-map-plugin-package.instructions.md | Controlled pluggable map-package support governance routes here first, then to Orchestration and Commander Console as the direct owners |
| nerve bus, command transport, command envelope, result envelope, ai request envelope, ai response envelope, transfer proof, channel routing | module-nerve-bus-capability.instructions.md | Governed transport authority only |
| ai ability group, first AI question, product presence judgment, comments OCR, intent analysis, pain point, complaint signal, opportunity synthesis, product signal, score, local model, prompt registry, prompt contract, prompt content, output schema ref | module-ai-capability.instructions.md | AI owns judgment; load Forensics or Commander only when persistence or review is the real boundary |
| src/capabilities/open, open ability group, open capability, open-tiktok, open-facebook, open-local-workbench, open result, capability-check, open proof | module-open-capability.instructions.md | Open capability authority only |
| src/capabilities/screenshot, screenshot ability group, screenshot capability, imageKind, coordinateSpace, scaleMapping, ai_input, evidence_original, evidence_optimized, capture-region, optimize-lossless, prepare-ai-input | module-screenshot-capability.instructions.md | Screenshot capability authority only |
| visual target, target bbox, target confidence, target catalog, candidate selection, clickPoint | module-visual-target-capability.instructions.md | Visual target authority only |
| geometry guard, coordinate action, coordinate safety, coordinate-space validation, scale mapping, executable geometry, normalized geometry | module-geometry-guard-capability.instructions.md | Route coordinate-action vocabulary to Geometry Guard first for safety ownership |
| src/capabilities/mouse-click, mouse click, click capability, primitive click, browser click, screen click | module-mouse-click-capability.instructions.md | Mouse click primitive authority only |
| src/capabilities/text-input, text input, type text, paste text, clear input, replace input, press key, commit input, keyboard input, input target | module-text-input-capability.instructions.md | Text input write authority only |
| src/capabilities/mouse-scroll, mouse scroll ability group, scroll capability, wheel scroll, scroll magnitude, region-wheel-scroll, browser-viewport-scroll, desktop-screen-scroll | module-mouse-scroll-capability.instructions.md | Mouse scroll capability authority only |
| post-action verification, action result verification, verification decision, result proof, after-click verification, after-scroll verification | module-post-action-verification-capability.instructions.md | Verification truth only |
| page state, page readiness, login wall, modal overlay, platform page kind, comment panel state, safety page | module-page-state-capability.instructions.md | Page-state truth only |
| multi-frame evidence, contact sheet, sample video frames, frame_3s, frame_6s, frame_10s, validFrameCount, samplingStrategy | module-screenshot-capability.instructions.md | Shared multi-frame packaging now starts from Screenshot and continues through AI and Forensics |
| evidence packet, browse ledger, failed record, runtime snapshot, forensics handoff, record envelope, record ref, artifact ref, packet schema, operator snapshot, review record | module-forensics-persistence-capability.instructions.md | Forensics record ownership only |
| platform profile, platform metadata, rate limit, adapter hint, view hint, identity rules, URL rules | module-open-capability.instructions.md | Platform profile and hints now route through Open capability as a sub-contract |
| local data, storage port, storage adapter, dedupe, retention, export, delete, traceability | module-forensics-persistence-capability.instructions.md | Route retired local-data vocabulary to the active Forensics write boundary |
| local persistence, sqlite, grasseye.sqlite, evidence file store, export set storage, storageRef, structured store, local persistence schema | module-forensics-persistence-capability.instructions.md | Local persistence schema now routes through Forensics child boundary |
| real chrome, persistent profile, browser profile, local browser session, login state reuse, profileRef, userDataDir, chrome executable, headless default, incognito | module-open-capability.instructions.md | Local real browser session now routes through Open child boundary |
| structured log, structured logging, runtime event, action log, debug runtime proof, log schema, sessionId, roundId, videoVisitId | module-forensics-persistence-capability.instructions.md | Structured runtime proof now routes through Forensics child boundary |
| credentials, cookies, session, token, privacy, sensitive screenshot, authorized account, privacy prompt boundary | module-security-privacy.instructions.md | Security and privacy only |
| startup script, launch script, bootstrap, dependency check, auto open page, health-gated launch, unique startup source, grasseye:start | module-commander-console-capability.instructions.md | Startup bootstrap now routes through Commander Console child boundary |
| localhost console, desktop app, macOS app, local app shell, local workbench, public exposure | module-commander-console-capability.instructions.md | Local app shell now routes through Commander Console child boundary |
| file placement, domain ownership, new directory, move files, topology, canonical path, phase goal, TODO plan, Codex prompt, acceptance report, archive, docs path, runtime data path | module-capability-group-governance.instructions.md | Topology contract now lives under capability-group governance |
| file length, function length, code purity, atomicity, nesting depth, complexity, dead code, commented-out code, debug leftovers, TODO hygiene, compatibility bridge, god function, giant function, god file, owner mixing | module-code-purity.instructions.md | Code Purity foundation law; audit-system only owns runner and enforcement plumbing |
| src/types, strict mode, unknown, schema validation, action payload, no any | module-type-safety.instructions.md | Type boundary only |
| src/lib/local-ai, local model, local AI, model router, prompt registry, prompt version, AI output schema, paid API, cloud AI fallback, model config, local model config, model role, vision model, OCR engine, model provider, ollama, llama.cpp, PaddleOCR, Apple Vision | module-ai-capability.instructions.md | Local model runtime now routes through AI capability as a child sub-contract |
| test file, tests directory, npm test, mock gate, quality gate authority | module-audit-system.instructions.md | Audit authority over quality gates only |
| scripts/audit, owner boundary, report format, generated artifacts, inspector, enforcement | module-audit-system.instructions.md | Audit governance only |

---

## Routing Boundary Statement

This index does not govern:
- Product-vs-non-product classification rules.
- Comment interpretation rules.
- Opportunity scoring criteria.
- Platform action legality beyond routing to the owning module.
- Deleted owner names such as agent-runtime, agent-mechanical-skills, agent-browse-flow, evidence-packet, vision-boundary, visual-only-runtime, visual-action-capability, comment-intelligence, product-signal, and operator-control.
