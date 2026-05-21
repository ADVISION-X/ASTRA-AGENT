---
name: "GrassEye Code Topology"
description: "Governs current job-flow source topology."
applyTo: "src/**, scripts/**, package.json"
---

# GrassEye Code Topology

status: active
version: 2026-05-21

Required roots:
- `src/plugins/amazon-invoice-upload/**` owns Amazon invoice upload flow.
- `src/capabilities/dom-automation/**` owns DOM primitives.
- `src/capabilities/ai-input-gateway/**` owns bounded AI provider transport.
- `src/capabilities/forensics-persistence/**` owns simple evidence storage.
- `src/lib/browser/**` owns browser session primitives.
- `src/lib/local-runtime/**` owns local assembly only.
- `src/app/**` owns minimal local HTTP workbench.

Retired roots must not exist as active code.
