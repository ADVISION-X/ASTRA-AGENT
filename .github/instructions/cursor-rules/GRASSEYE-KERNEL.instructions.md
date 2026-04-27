---
name: "GrassEye Kernel"
description: "Use when defining or reviewing GrassEye phase-one governance, authority order, canonical paths, and non-expandable system boundaries."
applyTo: ".github/instructions/cursor-rules/**"
---

# GrassEye Kernel

## System Identity

- Project: GrassEye
- 中文定位: 草眼 Agent / 种草产品挖掘系统
- System nature: local-first visual agent for product discovery research
- Product form: macOS local desktop workbench, with phase-one allowed to start as a localhost operator console plus local agent service.
- Current phase: phase-one governance foundation
- Core mission: discover evidence-backed product opportunities from social video feeds through local vision judgment, comment understanding, and operator review

## Authority Chain

1. User instruction
2. Workspace-level shared instructions when present
3. GRASSEYE-KERNEL.instructions.md
4. grasseye-index.instructions.md
5. One path-matched module law file
6. Operator decision for live execution

One issue has one active authority.

## Phase-One Business Anchor

GrassEye phase one has one and only one active chain:

浏览器视频页面
-> 视频区域截图
-> 本地视觉 AI 判断
-> 有限平台动作
-> 评论区 OCR
-> 评论文本理解
-> 产品机会记录
-> 操作者复核

## Core Principles

- 单一: one file, one job; one domain, one authority.
- 直接: short chains, clear routing, no second implementation path.
- 真实: only govern abilities that phase one will actually own and enforce.
- 可删除: reject ownerless, duplicated, drifting, or future-shell rules.
- AI execution posture: local AI first and phase-one governed execution must not silently fall back to paid or cloud AI APIs.
- Application posture: local UI, local agent runtime, local browser session, local AI boundary, and local evidence store.
- Operator-facing UI localization must support manual English / Chinese switching without cloud translation dependency.

## Global Red Lines

- Do not treat AI judgment as truth.
- Do not create a second execution chain beside the phase-one anchor.
- Do not default to cloud upload for screenshots or sensitive evidence.
- Do not automatically call paid API, cloud AI API, or remote model fallback when local AI fails.
- Do not hide external AI calls inside helper layers, model adapters, or business-domain code.
- Do not use cloud translation or runtime AI translation as the default path for operator-facing UI localization.
- Do not scatter operator-facing UI copy across route handlers, server rendering, or unrelated feature files.
- Do not use repository test files, mock-only quality gates, or npm test as release truth; GrassEye quality authority is the audit system.
- Do not turn GrassEye into a SaaS-hosted crawler, remote browser automation service, browser-extension-only product, or CLI-only primary experience.
- Do not expose the local operator console, local agent runtime, screenshots, cookies, sessions, or evidence store to the public internet by default.
- Do not bypass platform security, login protection, or anti-automation controls.
- Do not create account farms, proxy pools, fingerprint spoofing, or engagement abuse.
- Do not auto-comment, auto-message, auto-follow, or mass-like.
- Do not collect private data, private messages, or non-public pages.
- Do not turn product signals into automatic purchasing, listing, or ad decisions.
- Do not commit local runtime screenshots, OCR dumps, browser sessions, cookies, model cache, or evidence databases as repository truth.
- Do not place phase goals, TODO plans, Codex prompts, blueprints, and reports in root-level scattered files.

## Canonical Paths

- Law home: .github/instructions/cursor-rules
- Module law home: .github/instructions/cursor-rules/modules
- Route entry: src/app
- Feature domains: src/features/agent, src/features/vision, src/features/platform-action, src/features/comments, src/features/product-signal, src/features/local-data, src/features/operator-control
- Shared infrastructure: src/lib
- Cross-domain types: src/types
- Audit home: scripts/audit
- Phase goals: docs/阶段目标
- Phase TODO plans: docs/TODO
- Codex prompts: docs/Codex提示词
- Acceptance reports: docs/验收报告
- Law blueprints: docs/法案辅助文件
- Local runtime data: outside repository source truth; development-only local data must be gitignored
- Source narrative: docs/项目方案

## Current Execution Window

- This window may establish the phase-one audit system main chain under scripts/audit while keeping business implementation out of scope.
- No business code, database schema, UI, OCR logic, AI calling logic, browser automation, or runtime data enter this round.

## Phase-One Capability Boundary

- Browser-based feed observation for product discovery research.
- Video-area screenshot capture.
- Local-first visual classification.
- Platform-neutral core with adapter-bound execution.
- Limited, auditable platform actions.
- Platform-specific behavior must stay behind the platform-action adapter boundary and must not alter the phase-one chain.
- Comment screenshot capture, OCR, and text understanding.
- Evidence-backed product opportunity records.
- Operator review before any final business decision.

## Forbidden Directions

- Marketplace, ads, procurement, supplier, ERP, CRM, account-farm, or multi-platform growth systems.
- Batch interaction tooling or account manipulation.
- Endless crawling, broad scraping, or private identity profiling.
- Platform-specific shortcuts that bypass the governed adapter boundary or turn GrassEye into platform manipulation tooling.
- Any rule that widens scope beyond phase-one discovery research.

## Fingerprint Index

- kernel: GRASSEYE-KERNEL.instructions.md
- router: grasseye-index.instructions.md
- agent-runtime: modules/module-agent-runtime.instructions.md
- agent-browse-flow: modules/module-agent-browse-flow.instructions.md
- evidence-packet: modules/module-evidence-packet.instructions.md
- multi-frame-evidence: modules/module-multi-frame-evidence.instructions.md
- vision-boundary: modules/module-vision-boundary.instructions.md
- platform-action: modules/module-platform-action.instructions.md
- visual-action-capability: modules/module-visual-action-capability.instructions.md
- comment-intelligence: modules/module-comment-intelligence.instructions.md
- product-signal: modules/module-product-signal.instructions.md
- local-data: modules/module-local-data.instructions.md
- operator-control: modules/module-operator-control.instructions.md
- security-privacy: modules/module-security-privacy.instructions.md
- code-topology: modules/module-code-topology.instructions.md
- code-purity: modules/module-code-purity.instructions.md
- type-safety: modules/module-type-safety.instructions.md
- local-ai-runtime: modules/module-local-ai-runtime.instructions.md
- local-app-shell: modules/module-local-app-shell.instructions.md
- localization: modules/module-localization.instructions.md
- local-browser-session: modules/module-local-browser-session.instructions.md
- local-persistence-schema: modules/module-local-persistence-schema.instructions.md
- structured-logging: modules/module-structured-logging.instructions.md
- audit-system: modules/module-audit-system.instructions.md