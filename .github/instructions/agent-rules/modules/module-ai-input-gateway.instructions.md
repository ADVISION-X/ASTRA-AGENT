---
name: "GrassEye AI Input Gateway"
description: "Governs external provider transport for bounded AI choice questions."
applyTo: "src/capabilities/ai-input-gateway/**"
---

# GrassEye AI Input Gateway

status: active
version: 2026-05-21
capabilityGroupId: ai-input-gateway

## Boundary

AI Input Gateway transports bounded choice-judge packages to an approved provider and returns schema-validated choice results with provider proof.

It owns:
- provider delivery;
- response retrieval;
- transport proof;
- JSON extraction and schema validation;
- provider isolation.

It does not own:
- business judgment;
- Amazon upload flow;
- visual missions;
- browser control;
- action planning.

## Law GRASSEYE-AI-FEED-001-V2

Required:
- Input packages must be bounded choice questions.
- Results must validate to `selectedOptionId`, `confidence`, and `reason`.
- Provider proof survives success, failure, and review-required outcomes.

Forbidden:
- accepting or returning `nextAction`;
- accepting or returning arbitrary action plans;
- provider adapters importing plugin internals;
- plugins importing provider adapter internals directly.
