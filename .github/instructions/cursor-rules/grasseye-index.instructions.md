---
name: "GrassEye Index"
description: "Use when routing GrassEye phase-one work to the correct module law, checking always-loaded governance files, or reviewing narrow path triggers."
applyTo: ".github/instructions/cursor-rules/**"
---

# GrassEye Index

Role: locate active GrassEye laws for the current repository only.
Boundary: this file routes; it does not define business rules or replace a module owner.
Excludes: module law content, implementation plans, future inactive capabilities, and duplicated kernel text.
Authority: this file is authoritative only for GrassEye law routing.

---

## Always Loaded Files

- GRASSEYE-KERNEL.instructions.md
- grasseye-index.instructions.md

Kernel loads first.
Index only locates the narrowest current authority.

---

## Routing Rules

- Load GRASSEYE-KERNEL before any module match.
- Match the narrowest domain by path and task keywords.
- Do not activate absent historical paths.
- Do not use broad patterns to revive future capabilities.
- When two modules appear close, choose the one that directly owns the decision or record boundary.

---

## Active Module Routes

| Path or trigger | Load module | Routing note |
| -- | -- | -- |
| src/app, src/features/agent, observe, classify, act, record, pause, stop | module-agent-runtime.instructions.md | Runtime loop authority only |
| browse flow, product presence, next video, wait video stable, identify current video, comment sampling, round outcome, like marker, recommendation tuning marker, first AI question | module-agent-browse-flow.instructions.md | Browse decision-chain authority only |
| multi-frame evidence, contact sheet, sample video frames, frame_3s, frame_6s, frame_10s, validFrameCount, samplingStrategy | module-multi-frame-evidence.instructions.md | Multi-frame product-presence evidence authority only |
| evidence packet, forensics handoff, advanced ai handoff, data quality flags, action purpose, packetId, videoVisitId, packet schema | module-evidence-packet.instructions.md | Evidence packet and advanced-AI handoff authority only |
| src/features/vision, screenshot classification, confidence, suggested action, visual target, target bbox, target confidence | module-vision-boundary.instructions.md | Vision judgment boundary only |
| visual action, visual target, coordinate action, geometry guard, post-action verification, target catalog, bounded fallback | module-visual-action-capability.instructions.md | Visual target to safe action authority only |
| src/features/platform-action, src/lib/browser, scroll, open video, like, save, open comments, not interested, platform adapter, browser controller, DOM click, coordinate click, selector, vision-first coordinate mode, coordinate action, browser geometry guard, screen capture, OS input, post-action screenshot verification, DOM fallback, selector fallback | module-platform-action.instructions.md | Platform action and platform adapter boundary only |
| src/features/comments, src/lib/ocr, comments OCR, purchase intent, pain point, complaint signal | module-comment-intelligence.instructions.md | Comment evidence only |
| src/features/product-signal, opportunity record, product signal, score, evidence summary | module-product-signal.instructions.md | Opportunity signal only |
| src/features/local-data, src/lib/storage, dedupe, retention, export, delete, traceability | module-local-data.instructions.md | Local data authority only |
| local persistence, sqlite, grasseye.sqlite, evidence file store, export set storage, storageRef, structured store, local persistence schema | module-local-persistence-schema.instructions.md | Local persistence schema authority only |
| real chrome, persistent profile, browser profile, local browser session, login state reuse, profileRef, userDataDir, chrome executable, headless default, incognito | module-local-browser-session.instructions.md | Local real browser session boundary only |
| structured log, structured logging, runtime event, action log, live proof, log schema, sessionId, roundId, videoVisitId | module-structured-logging.instructions.md | Structured runtime truth and proof boundary only |
| src/features/operator-control, src/app/operator, review, manual override, candidate pool | module-operator-control.instructions.md | Operator authority only |
| localization, i18n, locale, language switch, English, Chinese, 中文, UI copy, dictionary, translation key | module-localization.instructions.md | Operator-facing localization boundary only |
| credentials, cookies, session, token, privacy, sensitive screenshot, authorized account | module-security-privacy.instructions.md | Security and privacy only |
| file placement, domain ownership, new directory, move files, topology, canonical path, phase goal, TODO plan, Codex prompt, acceptance report, archive, docs path, runtime data path | module-code-topology.instructions.md | Path ownership only |
| file length, function length, code purity, atomicity, nesting depth, complexity, dead code, commented-out code, debug leftovers, TODO hygiene, compatibility bridge, giant function, god file | module-code-purity.instructions.md | Code internal purity and maintainability only |
| src/types, strict mode, unknown, schema validation, action payload, no any | module-type-safety.instructions.md | Type boundary only |
| src/lib/local-ai, local model, local AI, model router, prompt registry, prompt version, AI output schema, paid API, cloud AI fallback, model config, local model config, model role, vision model, OCR engine, model provider, ollama, llama.cpp, PaddleOCR, Apple Vision | module-local-ai-runtime.instructions.md | Local AI execution and prompt contract boundary only |
| localhost console, desktop app, macOS app, local app shell, local runtime, Electron, Tauri, SwiftUI, local workbench, public exposure | module-local-app-shell.instructions.md | Local application form and runtime shell boundary only |
| startup script, launch script, bootstrap, dependency check, auto open page, health-gated launch | module-local-app-shell.instructions.md | Startup lifecycle boundary only |
| scripts/startup, startup helper path, launch script placement, bootstrap path | module-code-topology.instructions.md | Startup file placement only |
| test file, tests directory, npm test, mock gate, quality gate authority | module-audit-system.instructions.md | Audit authority over quality gates only |
| scripts/audit, owner boundary, report format, generated artifacts, inspector | module-audit-system.instructions.md | Audit governance only |

---

## Routing Boundary Statement

This index does not govern:
- Product-vs-non-product classification rules.
- Comment interpretation rules.
- Opportunity scoring criteria.
- Platform action legality beyond routing to the owning module.