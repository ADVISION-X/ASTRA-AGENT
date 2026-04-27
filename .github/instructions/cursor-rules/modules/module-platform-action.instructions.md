---
name: "GrassEye Platform Action"
description: "Use when defining allowed GrassEye platform actions, action rate limits, auditability, or anti-abuse boundaries."
applyTo: ".github/instructions/cursor-rules/modules/module-platform-action.instructions.md, src/features/platform-action/**, src/lib/browser/**"
---

# GrassEye Platform Action

Scope: governs the finite set of platform actions allowed in phase one.
Boundary: this module governs only browser-side research actions triggered by structured AI output or operator commands.
Excludes: visual classification, comment semantics, product scoring, and account growth strategy.
Authority: this file is authoritative only for the platform-action capability domain.

---

## Law GRASSEYE-PLATFORM-ACTION-001-V1

status: active
tier: P0
capabilityDomain: platform-action
enforcementMode: manual-first
evidenceMode: law

summary: GrassEye platform actions are a narrow, auditable research surface and may not become an abuse tool.

### 主题

有限平台动作与反滥用边界

### 法条

Phase-one platform actions are limited to scroll, open video, screenshot video area, click not interested, like or save product candidate, open comments, screenshot comments, and return or continue.

Required direction:
- Every action must be triggered by validated structured AI output or an explicit operator instruction.
- Action frequency must be rate-limited and reviewable.
- Every action must write an auditable record tied to evidence.
- Platform action success requires StructuredActionLog with actionPurpose and result proof.
- Real-platform actions must operate only inside the governed local Chrome session boundary.
- Platform-specific clicks, scrolls, captures, and comment-opening operations must pass through the governed PlatformAdapter or BrowserController boundary.
- GrassEye Core must not call ad hoc selectors, raw coordinates, or platform-specific click logic directly.
- For real-platform actions, coordinate-based execution is the adapter-internal production path when visual target evidence, target confidence, browser geometry guard, post-action verification, and action logging are available.
- Platform actions used in browse flow must have visual target capability before being treated as production-ready.
- DOM / Playwright selector or semantic execution is not a real-platform acceptance path. BrowserController may use Playwright only for browser infrastructure such as launch, navigation, screenshot, geometry, and coordinate input.
- scroll_next_video, open_comments, like/save marker, and click_not_interested must all be visual-target governed.
- Platform actions must stay inside research behavior and must not simulate social growth operations.
- Any selector-based action found in real-platform adapter must fail audit unless explicitly marked as archived or fixture-only.

### 禁止

FORBIDDEN:
- Automatic commenting, messaging, following, batch liking, or account switching.
- CAPTCHA bypass, login-protection bypass, or anti-automation bypass.
- Hidden temporary browser contexts for real-platform actions.
- Proxy pools, account pools, fingerprint spoofing, or similar evasion tooling.
- Ad hoc platform clicking scattered outside the platform-action owner.
- Core logic directly depending on Facebook, TikTok, YouTube, Instagram, or any platform-specific DOM shape.
- Exposing raw coordinate click as a cross-domain public action primitive.
- Any platform interaction pattern whose purpose is engagement manipulation rather than product research.

---

## Law GRASSEYE-PLATFORM-ACTION-002-V1

status: active
tier: P0
capabilityDomain: platform-action
enforcementMode: manual-first
evidenceMode: law

summary: Real-platform actions must use governed vision-first coordinate execution as the only production acceptance path.

### 主题

视觉优先坐标操作主权

### 法条

GrassEye real-platform actions must use a governed vision-first coordinate mode as the primary execution path: visual target detection, browser geometry guard, bounded coordinate action, post-action screenshot verification, and action logging.

Required direction:
- Real-platform adapters must keep platform-specific coordinate and DOM knowledge inside the adapter boundary.
- Coordinate actions must be based on visual target evidence, target confidence, and browser geometry guard status.
- Each coordinate action must record before/after evidence or action log references.
- DOM / Playwright selector or semantic execution is not a real-platform production acceptance path.
- BrowserController may use Playwright only for browser infrastructure such as launch, navigation, screenshot, geometry, and coordinate input.
- Unknown UI, moved window, low confidence target, login page, CAPTCHA, or platform safety page must route to pause, stop, or operator review.

### 禁止

FORBIDDEN:
- AgentRuntime directly calling raw coordinates, selectors, or platform-specific DOM.
- Coordinate clicks without visual target evidence.
- DOM selector execution as any real-platform acceptance path.
- Stealth, anti-detection, fingerprint spoofing, captcha bypass, proxy pool, or account pool behavior.
- Claiming coordinate mode is valid when browser geometry guard or post-action verification is missing.

---

## 模块边界声明

This law file does not govern:
- How AI decides whether content is product-related.
- How comment text or opportunity records are interpreted.