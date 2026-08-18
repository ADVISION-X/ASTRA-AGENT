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
-> read-only Browser Runtime preflight when cold start is required
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
  ],
  "clauses": [
    {
      "clauseId": "apex-startup-001-requirement",
      "statement": "GrassEye startup must have exactly one user-facing startup command and one local startup entrypoint.",
      "evidenceMode": "static",
      "ownerDomain": "startup-entrypoint"
    }
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
  ],
  "clauses": [
    {
      "clauseId": "apex-startup-002-requirement",
      "statement": "Startup may open the workbench but must not execute business flows, DOM abilities, browser actions, AI judgment, CI, or old registry readiness.",
      "evidenceMode": "static",
      "ownerDomain": "startup-entrypoint"
    }
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
  ],
  "clauses": [
    {
      "clauseId": "apex-startup-003-requirement",
      "statement": "Startup readiness must be proven by the local app health endpoint, not by the home page or job-specific readiness.",
      "evidenceMode": "static",
      "ownerDomain": "startup-entrypoint"
    }
  ]
}
```

Required:

- Startup probes `GET /api/health`.
- Before a cold start clears the port, startup must call the single Browser owner read-only preflight.
- The Browser Runtime preflight may verify enrollment, signed artifact presence, installation and release identity, but must not install, enroll, repair, activate, rollback, compile, or modify Chrome state.
- A local Browser Runtime test mode is allowed only when `GRASSEYE_BROWSER_RUNTIME_MODE=test` is explicitly present; it may accept Apple Development/Personal Team signatures without `spctl`, but it must still run the same hash, release tuple, enrollment, install/doctor and Authority checks. The default remains production.
- A failed Browser Runtime preflight must stop cold start with a concrete `failureReason` and actionable message; it must not spawn the app server and wait for a secondary `/api/health` fetch failure.
- Startup fails with a concrete `failureReason` if the health endpoint is not reachable.
- Opening the browser is downstream of health readiness.

Forbidden:

- Treating root HTML as the readiness source.
- Treating any job mission readiness as startup readiness.

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
  ],
  "clauses": [
    {
      "clauseId": "apex-startup-004-requirement",
      "statement": "Startup must emit structured terminal events with failure reasons while remaining subordinate to runtime logs and evidence.",
      "evidenceMode": "static",
      "ownerDomain": "startup-entrypoint"
    }
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
  ],
  "clauses": [
    {
      "clauseId": "apex-startup-005-requirement",
      "statement": "Every startup must keep a real local port cleanup path that discovers listeners, terminates stale listeners, and verifies the port is clear before starting a new app server.",
      "evidenceMode": "static",
      "ownerDomain": "startup-entrypoint"
    }
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
  ],
  "clauses": [
    {
      "clauseId": "apex-startup-006-requirement",
      "statement": "Startup must hot-mount an already healthy local workbench instead of killing and restarting it.",
      "evidenceMode": "static",
      "ownerDomain": "startup-entrypoint"
    }
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

## [APEX-STARTUP-007-V1] Cold Start Health Budget

```apex-law
{
  "lawId": "APEX-STARTUP-007-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "startup-entrypoint",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+runtime",
  "summary": "Started local workbench health readiness must use a production cold-start budget and must not fail before the app server has a reasonable chance to bind and answer /api/health.",
  "appliesTo": [
    "scripts/startup/lib/service-readiness.mjs",
    "scripts/startup/launch-grasseye.mjs"
  ],
  "required": [
    "waitForWorkbenchHealth default readiness budget is at least 60000ms.",
    "waitForWorkbenchHealth default poll interval is between 250ms and 1000ms.",
    "Startup still probes only /api/health and still fails closed with a concrete failureReason after the budget is exhausted."
  ],
  "forbidden": [
    "Started-service health readiness budget below 60000ms.",
    "Treating child process spawn as app readiness.",
    "Opening the workbench before /api/health passes.",
    "Replacing /api/health readiness with homepage readiness."
  ],
  "clauses": [
    {
      "clauseId": "apex-startup-007-requirement",
      "statement": "Started local workbench health readiness must use a production cold-start budget and must not fail before the app server has a reasonable chance to bind and answer /api/health.",
      "evidenceMode": "acceptance",
      "ownerDomain": "startup-entrypoint"
    }
  ]
}
```

Required:

- Started-service health readiness must tolerate normal local cold start and TypeScript dev server load.
- The default readiness budget must be at least `60000ms`.
- The default readiness poll interval must stay bounded between `250ms` and `1000ms`.
- Spawn success is only process readiness; app readiness remains `/api/health`.

## [APEX-STARTUP-008-V1] Initialization-Truthful Health

```apex-law
{
  "lawId": "APEX-STARTUP-008-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "startup-entrypoint",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+runtime",
  "summary": "The workbench health endpoint and startup probe must report ready only after every mandatory runtime owner has initialized successfully, and initialization failure must close the started server and fail startup.",
  "appliesTo": [
    "src/app/server.ts",
    "src/lib/local-runtime/workbench.ts",
    "src/lib/local-runtime/workbench-status.ts",
    "scripts/startup/lib/service-readiness.mjs"
  ],
  "required": [
    "GET /api/health includes a mandatory runtime-initialization component whose state is initializing, ready, or failed.",
    "Only status=healthy is accepted by cold-start readiness and hot-mount probes.",
    "A mandatory owner initialization exception is preserved as a bounded non-secret health reason, closes the newly started HTTP server, and makes the app process exit non-zero."
  ],
  "forbidden": [
    "Reporting healthy before mandatory runtime initialization settles.",
    "Accepting degraded as startup-ready or hot-mount-ready.",
    "Leaving the HTTP listener alive after mandatory owner initialization fails.",
    "Hiding an asynchronous initialization failure behind browser-session health."
  ],
  "clauses": [
    {
      "clauseId": "apex-startup-008-requirement",
      "statement": "The workbench health endpoint and startup probe must report ready only after every mandatory runtime owner has initialized successfully, and initialization failure must close the started server and fail startup.",
      "evidenceMode": "acceptance",
      "ownerDomain": "startup-entrypoint"
    }
  ]
}
```

Required:

- The app may bind its local port while initialization is in progress, but `/api/health` must remain non-healthy until all mandatory owners finish initialization.
- Initialization failure must remain visible long enough to produce the real terminal failure, then the newly started listener must close.
- Health reasons must identify the failed owner without returning credentials, tokens, cookies, prompts, or provider output.
