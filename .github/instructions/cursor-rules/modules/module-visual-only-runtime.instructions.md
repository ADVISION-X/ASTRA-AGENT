---
name: "GrassEye Visual Only Runtime"
description: "Use when defining visual-only real-platform operation, DOM/BOM prohibition, browser infrastructure allowance, and visual-first runtime boundaries."
applyTo: ".github/instructions/cursor-rules/modules/module-visual-only-runtime.instructions.md, src/features/agent/**, src/features/platform-action/**, src/features/comments/**, src/features/vision/**, src/lib/browser/**, src/lib/local-ai/**, scripts/audit/domains/visual-only-runtime/**, scripts/verify/verify-visual-only-runtime.mjs"
---

# GrassEye Visual Only Runtime

Scope: governs visual-only real-platform operation and prohibits DOM/BOM content-reading paths.
Boundary: this module governs runtime page-understanding and action-source authority only.
Excludes: browser process launch, local Chrome profile persistence, screenshot capture, coordinate input infrastructure, AI model installation, and final product analysis.
Authority: this file is authoritative only for the visual-only-runtime capability domain.

## Law GRASSEYE-VISUAL-ONLY-RUNTIME-001-V1

status: active
tier: P0
capabilityDomain: visual-only-runtime
enforcementMode: manual-first
evidenceMode: law

summary: real-platform page understanding and actions must be visual-only, not DOM/BOM content-reading or selector-driven.

### 主题

真实平台视觉唯一运行主权

### 法条

GrassEye real-platform mode must understand and act on pages through screenshots, local visual AI, OCR, visual target detection, geometry guard, coordinate actions, post-action screenshot verification, and structured logs.

Required direction:
- Screenshot evidence is the source of page understanding.
- Local visual AI and OCR are the governed page interpretation path.
- Visual target detection is the governed target-location path.
- Coordinate action is the governed browser operation path.
- Browser infrastructure may open URL, screenshot, report geometry, and execute coordinate input.
- Browser infrastructure must not become a DOM-reading or selector-action owner.
- Metrics must be extracted visually or recorded unavailable.
- Comments must be captured as screenshots and extracted through OCR/local AI.
- DOM / Playwright semantic execution must not be a hidden fallback.
- If visual target detection fails, runtime must skip, retry, or review.
- Production readiness requires post-action screenshot verification or explicit unable_to_verify reason.

FORBIDDEN:
- DOM/BOM page content reading for real-platform understanding.
- querySelector / locator / getByText / textContent / innerText as real-platform understanding or action source.
- DOM selector clicks as real-platform action acceptance.
- DOM scrape comments.
- DOM scrape metrics.
- DOM scrape product data.
- DOM semantic fallback after visual failure.
- Accessibility tree crawling as page-content source unless separately approved as an accessibility mode, not production default.
- BrowserController becoming a crawler.
- AgentRuntime owning selectors or raw coordinates.
- Fake visual result, fake evidence, fake verification, fake PASS.