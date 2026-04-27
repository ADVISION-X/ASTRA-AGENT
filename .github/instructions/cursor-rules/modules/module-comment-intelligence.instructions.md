---
name: "GrassEye Comment Intelligence"
description: "Use when defining comment screenshots, OCR extraction, comment cleaning, purchase intent analysis, or evidence binding for comment understanding."
applyTo: ".github/instructions/cursor-rules/modules/module-comment-intelligence.instructions.md, src/features/comments/**, src/lib/ocr/**"
---

# GrassEye Comment Intelligence

Scope: governs comment-area capture, OCR extraction, cleaned text, and comment signal understanding.
Boundary: this module governs comment evidence and comment meaning only.
Excludes: visual product classification, platform action policy, user identity profiling, and final commercial decisions.
Authority: this file is authoritative only for the comment-intelligence capability domain.

---

## Law GRASSEYE-COMMENT-INTELLIGENCE-001-V1

status: active
tier: P0
capabilityDomain: comment-intelligence
enforcementMode: manual-first
evidenceMode: law

summary: comment intelligence may extract demand signals only from evidence-backed comment screenshots and OCR text.

### 主题

评论证据、OCR 与需求信号

### 法条

Comment intelligence may operate only on comment screenshots, OCR text derived from them, and cleaned structured comment signals.

Required direction:
- Product-comment capture must bind comment screenshots to the source video evidence.
- OCR output must be cleaned before purchase intent, pain point, complaint, or demand-term analysis.
- Comment understanding must request model work through the governed local-AI runtime boundary when AI reasoning is used.
- Comment prompts must bind to evidence-backed OCR text and a structured output schema.
- Comment evidence must attach to the relevant product opportunity record.
- Comments must come from comment screenshots + OCR/local AI, not DOM text extraction.
- DOM comment scraping is forbidden.
- Signals may summarize demand, doubt, and recurring needs, but must preserve evidentiary traceability.

### 禁止

FORBIDDEN:
- Collecting or saving unnecessary personal identity information from commenters.
- Building personal profiles or tracking individuals across comments.
- Sending comment screenshots or OCR text to unauthorized external AI services.
- Hidden prompts that infer personal profiles or facts outside the comment evidence.
- Inflating a few comments into market truth.
- Fabricating OCR text or inventing comments that the evidence does not contain.

---

## 模块边界声明

This law file does not govern:
- Whether a video is product content.
- Whether an opportunity should become a final product decision.