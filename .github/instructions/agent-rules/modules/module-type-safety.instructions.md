---
name: "GrassEye Type Safety"
description: "Governs schemas and strict TypeScript boundaries."
applyTo: "src/**, scripts/**"
---

# GrassEye Type Safety

status: active
version: 2026-05-21

## Law GRASSEYE-TYPE-SAFETY-001-V1

```apex-law
{
  "lawId": "GRASSEYE-TYPE-SAFETY-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "architecture-boundary",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+typecheck",
  "summary": "External inputs, mediator boundaries, public facades, and flow results must remain schema-validated and explicitly typed, with typecheck retained as a blocking CI gate.",
  "clauses": [
    {
      "clauseId": "grasseye-type-safety-001-requirement",
      "statement": "External inputs must be schema-validated and owner public contracts must expose explicit result states without any, unvalidated JSON, or silent parse success.",
      "evidenceMode": "acceptance",
      "ownerDomain": "architecture-boundary"
    }
  ]
}
```

Required:
- External inputs are schema-validated.
- Flow results use explicit success, failure, and review-required states.
- Public facades export stable types.
- Typecheck is an active CI gate.

Forbidden:
- `any` escapes;
- unvalidated JSON at API boundaries;
- silent parse failures that pretend success.
