---
name: "GrassEye Structured Logging Redirect"
description: "Legacy route shim that delegates all runtime logging authority to Runtime Log Spine Final."
applyTo: ".github/instructions/cursor-rules/modules/module-structured-logging.instructions.md"
---

# GrassEye Structured Logging Redirect

status: active
version: 2026-05-21
role: redirect-only

This file exists only to preserve historical route compatibility.

## Binding Rule

All current structured runtime logging authority belongs exclusively to:

- .github/instructions/cursor-rules/modules/module-RuntimeLogSpine.instructions.md

Required direction:
- module-structured-logging must not define parallel logging laws, duplicate law IDs, or alternative runtime logging doctrine.
- Runtime logging code, AI transparency, redaction, terminal/file separation, and inspector rules must follow Runtime Log Spine Final only.
- If this file and Runtime Log Spine Final ever diverge, Runtime Log Spine Final wins immediately.

FORBIDDEN:
- treating this file as a second active runtime-logging constitution.
- restoring GRASSEYE-RUNTIME-LOG-SPINE-* or LAW-RLS-* law bodies here.
- splitting runtime logging authority across multiple active instruction files.
