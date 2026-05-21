---
name: "GrassEye Evidence Store"
description: "Governs simple evidence persistence for flow steps, artifacts, DOM snapshots, screenshots, results, and failure reasons."
applyTo: "src/capabilities/forensics-persistence/**, src/plugins/amazon-invoice-upload/**"
---

# GrassEye Evidence Store

status: active
version: 2026-05-21

## Boundary

Forensics Persistence is reduced to a simple evidence store.

It owns:
- step trace records;
- DOM snapshot references;
- screenshot references;
- upload result records;
- failure reasons;
- stable artifact references.

It does not own:
- business workflow control;
- owner universe matrices;
- audit truth;
- AI judgment;
- browser actions.

## Law GRASSEYE-EVIDENCE-001-V2

Required:
- Every business step may append a concise trace.
- Success and failure both include enough evidence to inspect what happened.
- Sensitive values are redacted before logs or evidence where required.
- Amazon upload results record status, reached step, reason, and artifact refs.

Forbidden:
- evidence store deciding next workflow step;
- multi-layer owner evidence universes;
- silent success or silent failure.
