---
name: "GrassEye Startup Entrypoint"
description: "Governs the single local workbench startup gate."
applyTo: "scripts/startup/**, package.json"
---

# GrassEye Startup Entrypoint

status: active
version: 2026-05-22
capabilityDomain: startup-entrypoint

## Boundary

Startup is the mountain gate of GrassEye. It opens the local workbench so a human
can choose a lawful job flow. It does not walk any job flow, judge a business
step, operate the browser, or prove evidence truth.

The only startup chain is:

```txt
dependency check
-> optional update preflight
-> hot-mount health probe
-> port clear when no healthy workbench is mounted
-> local app server start when no healthy workbench is mounted
-> /api/health readiness probe
-> open local workbench URL
-> structured terminal report
```

## [APEX-STARTUP-001-V1] Single Startup Gate

```apex-law
{
  "lawId": "APEX-STARTUP-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "startup-entrypoint",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs",
  "summary": "GrassEye startup must have exactly one user-facing startup command and one local startup entrypoint.",
  "appliesTo": [
    "package.json",
    "scripts/startup/**"
  ],
  "forbidden": [
    "Second user-facing startup command.",
    "Startup entrypoint outside scripts/startup/launch-grasseye.mjs.",
    "Startup acting as a general task launcher."
  ]
}
```

Required:

- `npm run grasseye:start` is the only user-facing startup command.
- `scripts/startup/launch-grasseye.mjs` is the only startup entrypoint.
- The command starts the local app shell only.

Forbidden:

- Second startup command.
- Startup shell hidden behind another script.
- Startup becoming a task launcher.

## [APEX-STARTUP-002-V1] Startup Does Not Walk Job Flows

```apex-law
{
  "lawId": "APEX-STARTUP-002-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "startup-entrypoint",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast",
  "summary": "Startup may open the workbench but must not execute business flows, DOM abilities, browser actions, AI judgment, CI, or old registry readiness.",
  "appliesTo": [
    "scripts/startup/**/*.{mjs,ts}",
    "package.json"
  ],
  "forbidden": [
    "Startup invoking a job flow.",
    "Startup invoking DOM, browser, upload, click, fill, or evidence actions.",
    "Startup invoking AI judgment or declaring provider readiness as mission truth.",
    "Startup running CI or audit gates.",
    "Startup requiring old registry readiness before app shell launch."
  ]
}
```

Required:

- Job readiness belongs to the job request or mission preflight.
- AI configuration and provider access belong to AI capability preflight.
- Evidence truth belongs to the evidence store and job flow result.

Forbidden:

- Startup calling business flow files.
- Startup calling child abilities.
- Startup hard-gating on registry readiness.
- Startup claiming AI runtime is mission-ready.
- Startup running `ci:full`, audit, acceptance, or typecheck.

## [APEX-STARTUP-003-V1] App Shell Readiness Probe

```apex-law
{
  "lawId": "APEX-STARTUP-003-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "startup-entrypoint",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs",
  "summary": "Startup readiness must be proven by the local app health endpoint, not by the home page or job-specific readiness.",
  "appliesTo": [
    "scripts/startup/launch-grasseye.mjs",
    "src/app/**"
  ],
  "forbidden": [
    "Readiness probe against the home page as the primary gate.",
    "Readiness probe against a job-specific endpoint.",
    "Readiness success without an HTTP status check."
  ]
}
```

Required:

- Startup probes `GET /api/health`.
- Startup fails with a concrete `failureReason` if the health endpoint is not reachable.
- Opening the browser is downstream of health readiness.

Forbidden:

- Treating root HTML as the readiness source.
- Treating Amazon or Facebook mission readiness as startup readiness.

## [APEX-STARTUP-004-V1] Structured Startup Report

```apex-law
{
  "lawId": "APEX-STARTUP-004-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "startup-entrypoint",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs",
  "summary": "Startup must emit structured terminal events with failure reasons while remaining subordinate to runtime logs and evidence.",
  "appliesTo": [
    "scripts/startup/**"
  ],
  "forbidden": [
    "Unstructured startup failure output.",
    "Startup logs replacing evidence or task status truth.",
    "Startup logs exposing credentials, cookies, tokens, or provider secrets."
  ]
}
```

Required fields:

- `phase`
- `component`
- `eventType`
- `status`
- `message`
- `refs`
- `durationMs`
- `failureReason`

Forbidden:

- Startup logs pretending to be evidence records.
- Startup logs leaking secrets.
- Startup success without failure handling.

## [APEX-STARTUP-005-V1] Real Port Clear Capability

```apex-law
{
  "lawId": "APEX-STARTUP-005-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "startup-entrypoint",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast",
  "summary": "Every startup must keep a real local port cleanup path that discovers listeners, terminates stale listeners, and verifies the port is clear before starting a new app server.",
  "appliesTo": [
    "scripts/startup/**/*.{mjs,ts}"
  ],
  "forbidden": [
    "Port clear implemented only as prose or log text.",
    "Starting a new app server on an occupied unhealthy port.",
    "Killing listeners without a post-clear listener check.",
    "Ignoring port clear failure and continuing startup."
  ]
}
```

Required:

- Startup must discover local TCP listeners for the configured workbench port.
- Startup must attempt graceful termination before force termination.
- Startup must verify no listener remains before starting a new local app server.
- Startup must fail with a concrete `failureReason` if the port cannot be cleared.

Forbidden:

- Pretending port clear passed without checking current listeners.
- Continuing to server start after a failed port clear.
- Clearing a healthy hot-mounted GrassEye workbench just because the port is occupied.

## [APEX-STARTUP-006-V1] Hot Mount Without Duplicate Restart

```apex-law
{
  "lawId": "APEX-STARTUP-006-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "startup-entrypoint",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast",
  "summary": "Startup must hot-mount an already healthy local workbench instead of killing and restarting it.",
  "appliesTo": [
    "scripts/startup/**/*.{mjs,ts}"
  ],
  "forbidden": [
    "Always killing the app port before checking health.",
    "Starting a duplicate app server when /api/health already passes.",
    "Treating hot mount as job readiness or evidence truth.",
    "Hot mount through a second startup command or second runtime chain."
  ]
}
```

Required:

- Startup must probe the configured `/api/health` before clearing the port.
- If the existing workbench is healthy, startup must reuse it, open the workbench URL, emit structured ready logs, and avoid spawning a duplicate app server.
- If the existing listener is unhealthy or not GrassEye health-ready, startup may clear the port and start the single local app server chain.

Forbidden:

- Duplicate dev servers on the same workbench port.
- Restarting a healthy workbench during code iteration.
- Using hot mount to execute job flows, browser actions, AI judgment, evidence writes, or CI.
