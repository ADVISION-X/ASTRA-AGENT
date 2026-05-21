---
name: "GrassEye Index"
description: "Routes current GrassEye pure visual single-round closed-loop governance."
applyTo: ".github/instructions/cursor-rules/**"
---

# GrassEye Index

Kernel loads first. The current top-level authority is:

- docs/法案辅助文件/GrassEye 纯视觉单轮闭环总纲施工图.md

## Active Execution Routes

| Trigger | Module |
| -- | -- |
| pure visual round, goalMatched, save, nextAction, AI output schema, prompt | modules/module-ai-capability.instructions.md |
| mission loop, save before action, single action dispatch, round state | modules/module-orchestration-capability.instructions.md |
| human mission command entry, pause/resume/stop/review command surface | modules/module-commander-console-capability.instructions.md |
| governed command/result transport, envelope chain fields, dispatch return | modules/module-nerve-bus-capability.instructions.md |
| target opening, target policy, real browser handoff | modules/module-open-capability.instructions.md |
| atomic action registry, AI-visible ability, Forensics action visibility | modules/module-capability-group-governance.instructions.md |
| evidence record, system save, artifact ref | modules/module-forensics-persistence-capability.instructions.md |
| screenshot, coordinate grid, gridSpec | modules/module-screenshot-capability.instructions.md |
| gridCell, cellZone, geometry proof | modules/module-geometry-guard-capability.instructions.md |
| click action | modules/module-mouse-click-capability.instructions.md |
| scroll action | modules/module-mouse-scroll-capability.instructions.md |
| text or key input action | modules/module-text-input-capability.instructions.md |
| DOM snapshot, DOM locator, DOM click, DOM wait, DOM verify, approved file upload | modules/module-dom-automation.instructions.md |
| video download, media artifact, Facebook video download, TikTok video download | modules/module-video-download-capability.instructions.md |
| AI feed, external AI provider, Gemini API feed, Gemini Web Chat, GPT Web Chat, provider adapter | modules/module-ai-input-gateway.instructions.md |

## Active Support Routes

| Trigger | Module |
| -- | -- |
| canonical capability roots, retired path deletion, topology purity | modules/module-code-topology.instructions.md |
| local shell form, local workbench boundary, desktop packaging | modules/module-local-app-shell.instructions.md |
| real Chrome session reuse, profile persistence, browser session privacy | modules/module-local-browser-session.instructions.md |
| local persistence schema, SQLite/file-store boundaries | modules/module-local-persistence-schema.instructions.md |
| unique bootstrap source, startup readiness, terminal startup logs | modules/module-startup-entrypoint.instructions.md |
| local model runtime wiring for AI | modules/module-local-ai-runtime.instructions.md |

## Active Cross-Cutting Routes

| Trigger | Module |
| -- | -- |
| runtime log spine, FLOW/DEBUG/TRACE, AI four-piece transparency | modules/module-RuntimeLogSpine.instructions.md |
| small-file architecture, dead-surface retirement, owner purity | modules/module-code-purity.instructions.md |
| audit ownership, generated-artifact handling, inspector boundaries | modules/module-audit-system.instructions.md |
| credential, session, cookie, and screenshot privacy red lines | modules/module-security-privacy.instructions.md |
| strict shared types, schemas, and validation boundaries | modules/module-type-safety.instructions.md |

## Retired Routes

Page-state, post-action verification, visual-target court, platform-action ownership, product-video-only judging, and advanced map generation plans must not route current runtime.
