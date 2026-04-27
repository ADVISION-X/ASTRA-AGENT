---
name: "GrassEye Product Signal"
description: "Use when defining product opportunity records, evidence-backed product signals, purchase-intent scoring, or signal-risk boundaries."
applyTo: ".github/instructions/cursor-rules/modules/module-product-signal.instructions.md, src/features/product-signal/**"
---

# GrassEye Product Signal

Scope: governs evidence-backed product opportunity signals and preliminary scoring.
Boundary: this module governs only product opportunity records, not final commercial action.
Excludes: browser execution, OCR extraction, procurement, listing, ads, and operator business approval.
Authority: this file is authoritative only for the product-signal capability domain.

---

## Law GRASSEYE-PRODUCT-SIGNAL-001-V1

status: active
tier: P0
capabilityDomain: product-signal
enforcementMode: manual-first
evidenceMode: law

summary: product signal output is an evidence-backed opportunity candidate, never a final business conclusion.

### 主题

机会信号而非最终选品

### 法条

Product signal may summarize product category, use case, selling points, pain points, purchase intent, dispute risk, and preliminary saleability only as an evidence-backed opportunity candidate.

Required direction:
- Every signal must bind back to video evidence, comment evidence, and the relevant AI outputs.
- Product signal may consume Evidence Packet, but must not treat it as final proof.
- Product-signal reasoning must request model work through the governed local-AI runtime boundary when AI reasoning is used.
- Product-signal prompts must preserve candidate status and evidence-backed uncertainty.
- Scoring must stay preliminary and explainable by evidence source.
- Risk and disagreement signals must travel with positive demand signals.
- Phase-one outputs must enter a candidate pool for operator review.
- Candidate remains pending_analysis until higher-level AI or operator review.

### 禁止

FORBIDDEN:
- Scoring without evidence.
- AI-generated product conclusions that exceed the available evidence.
- Paid or cloud AI fallback generating product conclusions without explicit operator approval.
- Prompts that ask AI to turn candidates into procurement, listing, or advertising decisions.
- Treating views as sales, likes as purchase intent, or one video as a trend.
- Auto-generating procurement, listing, or advertising decisions.

---

## 模块边界声明

This law file does not govern:
- How screenshots are captured or OCR text is extracted.
- Whether a human approves development, procurement, or launch.