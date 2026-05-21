---
name: "GrassEye Local App Shell"
description: "Governs the minimal local HTTP workbench."
applyTo: "src/app/**, src/lib/local-runtime/**"
---

# GrassEye Local App Shell

status: active
version: 2026-05-21

Required:
- The local app exposes Amazon invoice upload entry points, task status, health, mode, and settings if needed.
- The shell remains local-first.
- The shell does not decide business flow steps.

Forbidden:
- universal mission dashboards;
- old command consoles as active architecture;
- product-video dashboards;
- visual-runtime control panels.
