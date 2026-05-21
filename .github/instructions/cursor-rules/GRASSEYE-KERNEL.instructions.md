---
name: "GrassEye Kernel"
description: "Current GrassEye job-flow automation authority."
applyTo: ".github/instructions/cursor-rules/**"
---

# GrassEye Kernel

status: active
version: 2026-05-21

## System Identity

GrassEye is not a universal agent.
GrassEye is a job-oriented automation execution system.

The active architecture is:

```txt
Business Flow Script
  -> Ability Groups
      -> Child Abilities
          -> Evidence and Logs
```

## Highest Formula

```txt
One job = one explicit flow script.
One workflow = flow-owned step order.
One action type = one ability group.
One ability group = same-kind child abilities.
AI = bounded choice judge only.
Evidence proves every step.
```

## First Mainline

The first active business mainline is Amazon invoice / order upload.

The canonical flow owner is:

```txt
src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts
```

Any active code, law, script, or UI surface that cannot serve the Amazon upload mainline, DOM automation, browser session, AI choice judging, evidence storage, runtime logging, security, or type safety must be deleted or rewritten.

## Authority Split

- Business flow scripts own process order and business decisions.
- DOM Automation owns DOM snapshot, semantic location, fill, click, upload, wait, and verify primitives.
- Browser owns local session open, wait, screenshot evidence, and file-input foundation.
- AI Choice Judge may answer only bounded A/B/C/D questions.
- Evidence Store owns step traces, DOM snapshot references, screenshot references, result records, and failure reasons.
- Runtime Logs own structured FLOW / DEBUG / TRACE logs with redaction.

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
- Product-video DOM runtime as the active mainline.
- Muscle memory catalog or platform registry as workflow truth.
- Compatibility, bridge, or dual-truth tracks.

Retired terms may appear only in deletion notes, migration reports, or forbidden-regression checks.
