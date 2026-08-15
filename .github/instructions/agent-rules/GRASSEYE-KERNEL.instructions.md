---
name: "GrassEye Kernel"
description: "Current GrassEye job-flow automation authority."
applyTo: ".github/instructions/agent-rules/**"
---

# GrassEye Kernel

status: active
version: 2026-08-16

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
AI = bounded choice judge by default; a P0 job-flow law may authorize audited flow-scoped business content.
Evidence proves every step.
Audit is strict temple law, not a soft smoke gate.
Real-browser construction starts from personally observed live page structure and state order, never from a theoretically plausible browser model.
Every production stage confirms the intended identity and state, excludes adjacent false identities and states, requires one unique candidate, and stops at a fixed observation boundary.
```

## Real Browser Construction Admission

Any production change to BrowserController, the Chrome extension, DOM
Automation, or a job flow that depends on real page controls is admitted only
after Codex personally traverses the current failing state through the approved
Chrome extension or real-browser path.

The pre-construction observation must identify the exact controlled target,
the before-state, light DOM and author-shadow structure, the browser-owned UA
shadow boundary where relevant, the actual action receiver, and the observed
after-state in the runtime trace. Production code may implement only that
observed structure and state order.

Typecheck, static audit, synthetic DOM, documentation, historical selectors,
screenshots, standard control semantics, and the statement that an approach
"should work" do not authorize browser production construction. An unobserved
state remains `UNKNOWN` and `NOT_PRODUCTION_VERIFIED`.

After every live failure, Codex must return to the exact failed page and trace
before changing the implementation again. No second speculative edit,
compatibility bridge, fallback, shadow path, or parallel browser chain may be
added without new live evidence. The final candidate must then be traversed
again through the same approved real-browser path. Pre-construction evidence
proves the source of the implementation contract; post-construction evidence
proves that the candidate actually works. Sensitive final actions remain
subject to the owning flow's human gate and explicit user authorization.

## Production Confirmation Boundary

Every production stage that observes an external, browser, provider, file,
process, or generated state must reach one owner-defined terminal boundary
before the next stage starts:

1. all required positive identity and state facts are present;
2. all named adjacent false targets, conflicting states, loading states, error
   states, stale states, foreign states and duplicate candidates are absent;
3. exactly one candidate remains when the action targets one object;
4. observation ends after an explicit maximum count or deadline;
5. ambiguity, conflict or exhaustion returns `failed` or `review_required` and
   performs no later side effect.

An unconditional search, observation, retry or scroll loop is forbidden. A
process-lifetime worker may remain alive only under its owning shutdown
contract; it may not use that lifetime as an unbounded business-stage
observation budget.

Production hardening is always: personally traverse the approved real path and
record both inclusion and exclusion facts; make the production code succeed
through that same ordered path; then bind the positive gate, negative gate,
uniqueness gate and bounded stop into active law, blueprint, owner inspection
and acceptance. This boundary does not authorize additional business content,
generic confirmation engines, compatibility, fallback, bridge, shadow paths or
a second chain.

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
- DOM Automation owns exactly six primitives: DOM snapshot, semantic location, fill, click, upload, and one-shot verify. Repeated observation and finite stopping belong to the owning Business Flow.
- Browser owns local session open, wait, screenshot evidence, and file-input foundation.
- AI Choice Judge owns bounded A/B/C/D questions by default; a P0 job-flow law may own a separate flow-scoped AI content stage only when the law defines prompt ownership, raw persistence, output contract, and audit coverage.
- Evidence Store owns step traces, DOM snapshot references, screenshot references, result records, and failure reasons.
- Runtime Logs own structured FLOW / DEBUG / TRACE logs with redaction.
- Audit System owns strict law parsing, owner inspectors, generated enforcement artifacts, runner gates, and CI-FULL binary PASS/FAIL.

## AI Boundary

By default AI may only return:

```txt
selectedOptionId + confidence + reason
```

An active P0 job-flow law may authorize a different AI output contract inside that one flow only when the law explicitly defines the flow-owned prompt bundle, raw AI persistence, downstream validation, and audit coverage.

AI must never return a workflow, browser command, selector, coordinate, file path, action plan, or next action. AI must never control payment, refund, delete, submission, or other sensitive final actions.

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
