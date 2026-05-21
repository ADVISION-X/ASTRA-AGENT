---
name: "GrassEye Security Privacy"
description: "Governs credentials, browser session data, screenshots, PDFs, and logs."
applyTo: "src/**, scripts/**"
---

# GrassEye Security Privacy

status: active
version: 2026-05-21

Required:
- Credentials, cookies, tokens, and secrets are never logged.
- Screenshots and DOM snapshots are evidence refs, not public telemetry.
- Approved invoice PDFs are selected by the caller and stored under local task evidence.
- Sensitive final submit can require human review.

Forbidden:
- AI choosing arbitrary files;
- AI controlling payment, refund, delete, or sensitive final submit decisions;
- leaking browser storage or full HTML into logs.
