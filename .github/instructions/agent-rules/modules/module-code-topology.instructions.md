---
name: "GrassEye Code Topology"
description: "Governs current job-flow source topology."
applyTo: "src/**, scripts/**, package.json"
---

# GrassEye Code Topology

status: active
version: 2026-05-21

Required roots:
- `src/mediator/**` owns job request routing only.
- `src/plugins/<job-id>/**` owns exactly one business job flow.
- `src/plugins/amazon-invoice-upload/**` owns the first validated Amazon invoice upload flow.
- `src/capabilities/dom-automation/**` owns DOM primitives.
- `src/capabilities/ai-input-gateway/**` owns bounded AI provider transport.
- `src/capabilities/forensics-persistence/**` owns simple evidence storage.
- `src/lib/browser/**` owns browser session primitives.
- `src/lib/local-runtime/**` owns local assembly only.
- `src/app/**` owns minimal local HTTP workbench.

Retired roots must not exist as active code.

New job roots are legal only after architecture law, mediator route, evidence contract, and acceptance proof exist.
