---
name: "GrassEye Capability Group Governance"
description: "Governs job-flow scripts, ability groups, child abilities, AI choice judging, and retired architecture bans."
applyTo: ".github/instructions/cursor-rules/**, src/capabilities/**, src/plugins/**, src/lib/local-runtime/**"
---

# GrassEye Capability Group Governance

status: active
version: 2026-05-21

## Law GRASSEYE-JOB-FLOW-001-V1

GrassEye uses job-oriented flow scripts as process owners.

Required:
- One job has one explicit business flow script.
- The business flow script owns step order, branch handling, stop conditions, and review-required decisions.
- Ability groups provide stable same-kind primitives and do not own business process order.
- Child abilities stay inside exactly one ability group.
- Evidence and logs are recorded for every meaningful step.

Forbidden:
- universal workflow planners;
- central dispatchers as process truth;
- general mission loops as business owners;
- muscle-memory or registry catalogs as workflow truth;
- compatibility, bridge, fallback, or dual-truth architecture.

## Law GRASSEYE-JOB-FLOW-002-V1

The active first job is Amazon invoice upload.

Required:
- `src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts` is the canonical flow owner.
- The flow may directly call browser, DOM automation, evidence, runtime logs, and AI choice judge facades.
- Amazon-specific decisions remain in `src/plugins/amazon-invoice-upload/**`.

Forbidden:
- Amazon workflow logic inside generic DOM/browser/evidence/AI provider transports;
- product-video or visual mission code on the active upload path;
- old ability groups acting as hidden upload dependencies.

## Law GRASSEYE-ABILITY-GROUP-003-V1

Current ability groups are simple same-kind work groups.

Active groups:
- DOM Automation: read, locate, fill, click, upload, wait, verify.
- Browser: open, wait, session state, screenshot evidence, file-input foundation.
- AI Choice Judge: bounded option questions only.
- Evidence Store: step trace and artifact references.
- Runtime Logs: structured redacted logs.

Forbidden top-level execution owners:
- Nerve Bus;
- Orchestration;
- Geometry Guard;
- Mouse Click;
- Mouse Scroll;
- Text Input;
- Open;
- Screenshot;
- Video Download;
- Product Video DOM Runtime;
- Pure Visual Mission.

## Law GRASSEYE-AI-CHOICE-004-V1

AI is a bounded choice judge only.

Required AI output:

```txt
selectedOptionId
confidence
reason
```

Forbidden AI output:
- next action;
- action plan;
- browser command;
- DOM selector;
- coordinate;
- arbitrary file path;
- generated business data;
- submission/payment/refund/delete decisions.
