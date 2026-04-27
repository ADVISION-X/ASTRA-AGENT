---
name: "GrassEye Vision Boundary"
description: "Use when defining video-area screenshots, local visual AI outputs, confidence handling, or structured vision result boundaries."
applyTo: ".github/instructions/cursor-rules/modules/module-vision-boundary.instructions.md, src/features/vision/**, src/lib/local-ai/**"
---

# GrassEye Vision Boundary

Scope: governs screenshot input and structured local visual judgment output.
Boundary: this module governs only the transition from video-area image evidence to structured vision result.
Excludes: browser action execution, OCR extraction, product opportunity scoring, and cloud workflow design.
Authority: this file is authoritative only for the vision-boundary capability domain.

---

## Law GRASSEYE-VISION-BOUNDARY-001-V1

status: active
tier: P0
capabilityDomain: vision-boundary
enforcementMode: manual-first
evidenceMode: law

summary: phase-one vision authority is local-first, structured, bounded, and confidence-aware.

### 主题

截图判断边界与结构化输出

### 法条

Video-area screenshots are the primary visual input, and local visual AI is the default phase-one judgment source.

Required direction:
- Vision input must stay inside the relevant video or comment evidence region.
- Product-presence vision input must default to a MultiFrameVideoEvidenceSet plus a governed contact sheet or governed multi-image input.
- AI output must be structured and limited to classification, confidence, reason, and suggested action.
- Vision classification must request model work through the governed local-AI runtime boundary.
- Vision prompts and outputs must bind to the local-AI prompt and schema contract.
- Single-frame product-presence fallback must be explicitly marked with inputMode, sampledFrameCount, validFrameCount, and uncertainty.
- Visual target detection for real-platform actions must produce target type, bounding box, confidence, source screenshot reference, and uncertainty.
- Visual target detection is a governed output distinct from product presence classification.
- Visual target detection must produce target catalog type, boundingBox, clickPoint, confidence, source evidence, and uncertainty.
- Page understanding in real-platform mode must come from screenshots and visual outputs, not DOM text.
- Agent code may consume only validated structured results, not free-text interpretation.
- Low-confidence results must route to skip or operator review.
- Low-confidence visual targets must route to skip, retry, or operator review.
- A single image must not assert facts that are not visible in that image.

### 禁止

FORBIDDEN:
- Treating AI judgment as absolute truth.
- Free-text model output directly driving platform actions.
- Direct cloud vision calls or paid vision API fallback from the vision boundary.
- Hidden vision prompts embedded outside the governed local-AI prompt contract.
- Strong actions on low-confidence classifications.
- Using a visual target for clicking without bounded region and confidence.
- Inferring invisible controls or page state from a screenshot without evidence.
- Default cloud upload of screenshots or unrelated screen capture.
- Capturing sensitive or irrelevant screen regions outside the evidence boundary.

---

## 模块边界声明

This law file does not govern:
- How the browser performs clicks or scrolling.
- How product opportunity records are scored or approved.