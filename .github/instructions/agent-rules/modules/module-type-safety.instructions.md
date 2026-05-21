---
name: "GrassEye Type Safety"
description: "Governs schemas and strict TypeScript boundaries."
applyTo: "src/**, scripts/**"
---

# GrassEye Type Safety

status: active
version: 2026-05-21

Required:
- External inputs are schema-validated.
- Flow results use explicit success, failure, and review-required states.
- Public facades export stable types.
- Typecheck is an active CI gate.

Forbidden:
- `any` escapes;
- unvalidated JSON at API boundaries;
- silent parse failures that pretend success.
