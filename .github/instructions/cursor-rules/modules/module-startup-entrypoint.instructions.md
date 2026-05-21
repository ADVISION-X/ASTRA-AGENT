---
name: "GrassEye Startup Entrypoint"
description: "Governs the local workbench startup command."
applyTo: "scripts/startup/**, package.json"
---

# GrassEye Startup Entrypoint

status: active
version: 2026-05-21

Required:
- `scripts/startup/launch-grasseye.mjs` is the local startup entrypoint.
- `grasseye:start` is the user-facing startup command.
- Startup starts the local app server, checks readiness, opens the local workbench URL, and reports failures.

Forbidden:
- startup running business flow steps;
- startup invoking AI judgment;
- startup acting as CI;
- startup requiring old registry readiness.
