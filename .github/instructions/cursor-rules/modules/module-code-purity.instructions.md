---
name: "GrassEye Code Purity"
description: "Governs dead-surface removal and small focused code for the job-flow architecture."
applyTo: "src/**, scripts/**"
---

# GrassEye Code Purity

status: active
version: 2026-05-21

Required:
- Files have one clear responsibility in the Amazon flow architecture.
- Deleted architecture is physically removed instead of wrapped.
- Flow code is explicit and readable.
- Shared helpers exist only when they reduce real duplication.

Forbidden:
- compatibility shells;
- bridge layers;
- shadow implementations;
- fake pass scripts;
- no-op quality gates;
- old runtime vocabulary as positive active design.
