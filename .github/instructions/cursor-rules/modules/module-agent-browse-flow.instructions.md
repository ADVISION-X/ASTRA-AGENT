---
name: "GrassEye Agent Browse Flow"
description: "Use when defining the GrassEye browse chain, first-question product presence AI contract, login or safety routing, or browse-step decision branching."
applyTo: ".github/instructions/cursor-rules/modules/module-agent-browse-flow.instructions.md, src/features/agent/**, src/lib/local-ai/prompts/**"
---

# GrassEye Agent Browse Flow

Scope: governs the browse main chain, the first-question AI contract, and the runtime branching rules between product presence, skip, comment reading, and review gates.
Boundary: this module governs browse decision flow only.
Excludes: final product analysis, procurement, profitability, ads, and operator approval.
Authority: this file is authoritative only for the agent-browse-flow capability domain.

---

## Law GRASSEYE-AGENT-BROWSE-FLOW-001-V1

status: active
tier: P0
capabilityDomain: agent-browse-flow
enforcementMode: manual-first
evidenceMode: law

summary: the browse main chain must ask one narrow first AI question about product presence from governed multi-frame evidence, then branch through explicit evidence-backed actions.

### 主题

浏览主链与第一问 AI 契约

### 法条

GrassEye browse runtime must stay on one explicit single-video lifecycle:

task start -> open target page -> detect login or safety state -> wait feed ready -> start one video round -> wait video stable -> identify current video -> calibrate geometry -> sample governed video frames -> create multi-frame evidence set -> create product-presence contact sheet or governed multi-image input -> ask local AI whether the sampled frames as a whole are showing a product -> validate structured output -> branch by governed decision -> record evidence and action log -> complete the round -> scroll next video -> next round, review, or stop.

Required direction:
- Open target page happens only at task start or explicit recovery, not on every next-video transition.
- Next video must return to wait_video_stable rather than reopening the target page.
- Each video round must identify the current video instance so duplicate screenshots, duplicate AI calls, duplicate comments, and duplicate candidates are prevented.
- Multi-frame sampling must happen only after page safety and video stability checks pass.
- The first AI question must be product presence only, not product quality.
- The first AI contract must ask whether the current video, across the sampled frames as a whole, is showing, demonstrating, using, unboxing, comparing, or clearly presenting a concrete product.
- The first AI question must default to governed multi-frame evidence rather than one opening screenshot.
- Default multi-frame sample times are 3s, 6s, and 10s after video stability.
- Sampled frames must stay under one roundId, one videoVisitId, and one MultiFrameVideoEvidenceSet.
- Contact sheet input is the preferred default when local AI multi-image support is uncertain.
- Multi-frame product-presence must run as one governed AI task by default, not three independent AI calls.
- At least two valid frames are required for normal product-presence classification.
- One-frame fallback must be explicitly marked and must reduce trust or route to review/skip according to policy.
- Zero valid frames must route to skipped_unstable_video or review_required.
- Only product_yes_high_confidence may enter the comment-reading chain.
- product_yes_high_confidence must collect pre-action metrics before any like or save marker can run.
- like or save may exist only as a recommendation tuning marker, not as growth behavior or final business judgment.
- product_no_high_confidence must route to scroll next or click not interested according to governed platform policy.
- product_uncertain must route to skip or operator review.
- Comment sampling must stay bounded to the visible first-screen or another explicitly capped capture window.
- Every round must end with one explicit round outcome.
- Every round must finalize into either a full Evidence Packet, a lightweight Browse Ledger entry, or an explicit failed/review record before scroll next.
- Full Evidence Packets are required only for product-related, operator-marked, review-required, or audit-worthy failed rounds.
- product_yes_high_confidence must finalize into Evidence Packet.
- product_no_high_confidence must finalize into Browse Ledger by default.
- duplicate and unstable rounds must finalize into Browse Ledger or skip summary.
- uncertain rounds must not create Evidence Packet unless operator marked or review_required.
- scroll_next_video may proceed after Browse Ledger finalization for non-product rounds.
- advanced AI export set must not be polluted by product_no browse entries.
- login wall, CAPTCHA, safety page, unknown UI, geometry mismatch, invalid AI output, and local AI unavailability must route to review_required or stop.
- Prompt contracts must be versioned, schema-bound, registry-backed, and evidence-bound.
- AI output must be schema validated before it can drive any platform action.
- Every browse step must emit StructuredRuntimeEvent before the round can claim progress.
- Every action must write an action log.
- Every branch action must emit StructuredActionLog with step, actionPurpose, and result proof.
- Browse flow cannot mark an action production-ready unless the action is backed by visual target capability.
- product_no scroll_next, product_yes open_comments, like/save marker, and comment screenshot must all use visual action capability.
- collect metrics, comment reading, button targeting, and next-video detection must be visual-only.
- product_no / product_yes branching must not read DOM.
- Round finalization must be proven by structured logs before scroll next video may begin.
- Every candidate must remain an evidence-backed pending_analysis candidate.
- The browse flow must not ask AI for procurement, advertising, profitability, supply-chain readiness, or final product-worth decisions.

### 禁止

FORBIDDEN:
- Asking the first AI prompt whether a product is good, profitable, or worth sourcing.
- Using a single opening screenshot as the default first-question product-presence input.
- Using three independent AI calls as the default multi-frame product-presence strategy.
- Free-text AI output directly driving platform actions.
- Reopening the target page as the normal next-video transition.
- Opening comments before the first product-presence decision exists.
- Liking or saving before pre-action metrics are recorded.
- Creating product candidates from product_no_high_confidence or invalid AI output.
- Creating candidates whose status is approved, profitable, winning, procurement_ready, or ads_ready.
- Continuing to click through login walls, CAPTCHA, safety pages, or geometry mismatch.
- Infinite comment scrolling, commenter profile entry, or private-message collection.
- Treating comment reading as available before comment evidence exists.
- Letting browse flow silently fake AI success, fake evidence, fake action, or fake PASS.
- Scrolling next video before packet finalization when the round is otherwise completable.
- Creating a full Evidence Packet for every product_no_high_confidence round by default.

---

## 模块边界声明

This law file does not govern:
- Whether a pending candidate is commercially good.
- Procurement, supplier choice, pricing, or ad launch decisions.
- OCR implementation details or final operator approval.