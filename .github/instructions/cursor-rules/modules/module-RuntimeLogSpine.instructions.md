---
name: "GrassEye Runtime Log Spine"
description: "Governs structured runtime logs for job-flow automation."
applyTo: "src/lib/runtime-logs/**, src/plugins/**, src/lib/local-runtime/**"
---

# GrassEye Runtime Log Spine

status: active
version: 2026-05-21

## Boundary

Runtime logs are structured diagnostic output for local job-flow execution.

Required channels:
- FLOW for business step progress;
- DEBUG for implementation diagnostics;
- TRACE for low-level references and timing.

Required:
- redact credentials, cookies, tokens, and sensitive user data;
- log step name, status, reason, and artifact refs when available;
- keep logs subordinate to evidence records.

Forbidden:
- logs replacing evidence store truth;
- owner-universe audit matrices as runtime log truth;
- AI prompt or provider secrets in logs.
