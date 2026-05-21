---
name: "GrassEye Kernel"
description: "Current GrassEye job-flow automation authority."
applyTo: ".github/instructions/agent-rules/**"
---

# GrassEye Kernel

status: active
version: 2026-05-21

## System Identity

GrassEye is not a universal agent.
GrassEye is a job-oriented automation execution system.

The active architecture is:

```txt
Job Request / API Entry
  -> Job Mediator
      -> Business Flow Script
          -> Ability Groups
              -> Child Abilities
                  -> Evidence and Logs
```

## Highest Formula

```txt
One job = one explicit flow script.
One workflow = flow-owned step order.
One user request = one mediator route to a known flow.
One action type = one ability group.
One ability group = same-kind child abilities.
AI = bounded choice judge only.
Evidence proves every step.
Audit is strict temple law, not a soft smoke gate.
```

## First Validated Job Flow

The first validated business job flow is Amazon invoice / order upload.

The canonical flow owner is:

```txt
src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts
```

Amazon is the first mature job flow, not the permanent only job flow.

New job flows are allowed only when they enter through a clear mediator route, own one explicit flow script, use existing or law-approved ability groups, record evidence, and pass strict audit and acceptance.

Any active code, law, script, or UI surface that cannot serve a lawful job flow, mediator route, DOM automation, browser session, AI choice judging, evidence storage, runtime logging, security, type safety, startup, or audit must be deleted or rewritten.

## Authority Split

- Business flow scripts own process order and business decisions.
- Job Mediator owns request routing, schema validation, and flow selection only; it never owns process order or browser actions.
- DOM Automation owns DOM snapshot, semantic location, fill, click, upload, wait, and verify primitives.
- Browser owns local session open, wait, screenshot evidence, and file-input foundation.
- AI Choice Judge may answer only bounded A/B/C/D questions.
- Evidence Store owns step traces, DOM snapshot references, screenshot references, result records, and failure reasons.
- Runtime Logs own structured FLOW / DEBUG / TRACE logs with redaction.
- Audit System owns strict law parsing, owner inspectors, generated enforcement artifacts, runner gates, and CI-FULL binary PASS/FAIL.

## AI Boundary

AI may only return:

```txt
selectedOptionId + confidence + reason
```

AI must not return a workflow, browser command, selector, coordinate, file path, arbitrary business data, action plan, or next action.

## Hard Bans

- Universal agent runtime as active architecture.
- Pure visual mission loop as active runtime.
- AI next-action chooser.
- General orchestration mission loop.
- Nerve Bus or central dispatcher.
- Geometry or coordinate grid as the main controller.
- Mouse click, mouse scroll, text input, open, screenshot, or video download as standalone top-level execution owners.
- Product-video DOM runtime as an ungoverned or resurrected old mainline.
- Muscle memory catalog or platform registry as workflow truth.
- Compatibility, bridge, or dual-truth tracks.
- Mediator routes that secretly plan, execute, or decide business steps.
- Audit warning-only, soft-pass, manual matrix truth, or runner-owned law binding.

Retired terms may appear only in deletion notes, migration reports, or forbidden-regression checks.
