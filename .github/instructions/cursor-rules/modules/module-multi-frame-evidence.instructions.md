---
name: "GrassEye Multi Frame Evidence"
description: "Use when defining multi-frame video sampling, contact sheet generation, product presence frame evidence, and multi-frame local AI input contracts."
applyTo: ".github/instructions/cursor-rules/modules/module-multi-frame-evidence.instructions.md, src/features/vision/**, src/features/agent/**, src/features/local-data/**, src/lib/local-ai/**, src/types/multi-frame-evidence.ts, scripts/audit/domains/multi-frame-evidence/**, scripts/verify/verify-multi-frame-evidence.mjs"
---

# GrassEye Multi Frame Evidence

Scope: governs multi-frame video sampling, contact sheet generation, multi-frame product presence evidence, and local AI input contracts.
Boundary: this module governs video evidence sampling before the first product-presence AI question.
Excludes: final product analysis, comment analysis, procurement, ads, and platform action semantics.
Authority: this file is authoritative only for the multi-frame-evidence capability domain.

---

## Law GRASSEYE-MULTI-FRAME-EVIDENCE-001-V1

status: active
tier: P0
capabilityDomain: multi-frame-evidence
enforcementMode: manual-first
evidenceMode: law

summary: the first product-presence AI question must use governed multi-frame evidence by default instead of a single opening screenshot.

### 主题

多帧视频取证与第一问 AI 准确性

### 法条

GrassEye must use multi-frame video evidence for the first product-presence AI question by default, so opening effects, black frames, captions, transitions, or delayed product reveals do not dominate classification.

Required direction:
- Product presence classification must default to multi-frame sampling.
- Default sample times are 3s, 6s, and 10s after video stability.
- The sampled frames must belong to one roundId and one videoVisitId.
- Sampled frames must be grouped under one MultiFrameVideoEvidenceSet.
- The local AI product-presence prompt must receive either a contact sheet or governed multi-image input.
- Contact sheet input is preferred when local AI multi-image support is uncertain.
- Multi-frame input should be one AI task by default, not three independent AI calls.
- Frame availability and sampling failures must be recorded.
- At least two valid frames are required for normal product-presence classification.
- One-frame fallback must reduce confidence or route to review/skip.
- Zero valid frames must route to skipped_unstable_video or review_required.
- Evidence Packet may include multi-frame evidence for product-related videos.
- Browse Ledger may keep only lightweight references or hashes for product_no by default.

FORBIDDEN:
- Single opening screenshot as the default product-presence input.
- Three independent AI calls as the default multi-frame strategy.
- Fake frame evidence.
- Fabricating unavailable frames.
- Treating one noisy frame as high-confidence product evidence.
- Storing full frame evidence for every product_no video by default.
- Asking AI to judge profitability, sourcing, ads, or product worth during product-presence classification.