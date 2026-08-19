---
name: "GrassEye Kernel"
description: "Current GrassEye job-flow automation authority."
applyTo: ".github/instructions/agent-rules/**"
---

# GrassEye Kernel

status: active
version: 2026-08-20

## System Identity

GrassEye is not a universal agent. GrassEye is a job-oriented automation execution system.

```txt
Job Request / API Entry
  -> Job Mediator
      -> Business Flow Script
          -> Ability Groups
              -> Child Abilities
                  -> Evidence and Logs
```

For browser-dependent work, the ability boundary is subordinate to one authenticated Browser Authority chain:

```txt
cloud execution lease/fence
  -> BrowserAuthorityBroker
      -> AuthenticatedBrowserAuthorityLease
          -> exact BrowserTargetLease
              -> governed capability command
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
Browser infrastructure may exist while authority is ABSENT; browser business capability exists only as a current authenticated execution-bound authority lease.
Every production browser action binds an exact target/document identity and a current cloud execution fence.
Real-browser construction starts from personally observed live page structure and state order, never from a theoretically plausible browser model.
Every production stage confirms intended identity/state, excludes adjacent false identities/states, requires one unique candidate and stops at a fixed observation boundary.
```

## Real Browser Construction Admission

Any production change to Browser Authority infrastructure, the Chrome extension, DOM Automation or a flow that depends on real page controls is admitted only after Codex personally traverses the current failing state through the approved single Browser Authority chain.

The pre-construction observation identifies the exact controlled target/document, current authority/execution binding, before-state, relevant DOM/shadow structure, real action receiver and observed after-state. Production code may implement only that observed structure and state order.

Typecheck, Static Audit, synthetic DOM, documentation, historical selectors, screenshots, standard control semantics and “should work” do not authorize browser production construction. An unobserved state is `UNKNOWN / NOT_PRODUCTION_VERIFIED`.

After every live failure, construction returns to the exact failed page and trace before another implementation change. No speculative second edit, compatibility bridge, fallback, shadow path or parallel browser chain is allowed without new live evidence. The final candidate is traversed again through the same approved chain. Sensitive final actions remain subject to owning flow human gates and explicit user authorization.

## Production Confirmation Boundary

Every production stage that observes external/browser/provider/file/process/generated state must reach one owner-defined terminal boundary before the next stage starts:

1. all required positive identity/state facts are present;
2. named adjacent false/conflicting/loading/error/stale/foreign/duplicate states are absent;
3. exactly one candidate remains when targeting one object;
4. observation ends after an explicit maximum count or deadline;
5. ambiguity/conflict/exhaustion returns failed/review_required and performs no later side effect.

An unconditional search/observation/retry/scroll loop is forbidden. Process-lifetime workers remain alive only under their shutdown contract and may not turn process lifetime into unbounded business-stage observation.

## Authority Split

- Business flow scripts own process order and business decisions.
- Job Mediator owns request routing/schema validation/flow selection only; never process order or browser actions.
- DOM Automation owns its declared semantic primitives and consumes an execution-bound `BrowserTargetLease`; it does not own Browser transport or arbitrary JavaScript evaluation.
- Browser owns infrastructure control state, authenticated authority, exact target/document identity, governed command admission, Native Messaging, profile/process identity, release activation and low-level action receipts.
- Browser does **not** own cloud job business truth, report success, provider verdict, Dynamic Proof verdict or execution election; xuanxue database lease/fence remains the single execution-writer truth.
- AI Choice Judge owns bounded choice by default; P0 flow law may own a separate flow-scoped content stage with explicit prompt/output/audit contracts.
- Evidence Store owns flow evidence records; Browser infrastructure logs never become a second evidence/business truth.
- Runtime Logs own structured FLOW/DEBUG/TRACE redacted logs.
- Audit System owns strict law parsing, explicit owner checks, generated enforcement artifacts and blocking CI gates.

## AI Boundary

By default AI may only return:

```txt
selectedOptionId + confidence + reason
```

An active P0 job-flow law may authorize a different output contract inside that one flow only when the law explicitly defines prompt bundle, raw persistence, downstream validation and audit coverage.

AI must never return a workflow, browser command, selector, coordinate, filesystem path, action plan or next action. AI never controls payment/refund/delete/submission or other sensitive final actions.

## Browser Hard Boundary

Production source must not contain or expose as lawful runtime concepts:

```txt
UnauthenticatedBrowserSession
BrowserTargetSession
BrowserController.createTargetSession
transportReady
waitUntilReady
READY_COMPATIBLE
arbitrary evaluate(script)
raw/resolved file path wire command
active-tab/current-page/URL-first page identity
second browser transport
```

Browser-dependent jobs acquire a current authority lease before a writer lane and an exact target lease before commands. Any authority/fence/document discontinuity invalidates the lease before subsequent side effects.

## Hard Bans

- Universal agent runtime as active architecture.
- Pure visual mission loop as active runtime.
- AI next-action chooser.
- General orchestration mission loop.
- Nerve Bus or central dispatcher.
- Geometry/coordinate grid as main controller.
- Mouse click/scroll/text/open/screenshot/video download as standalone top-level execution owners.
- Product-video DOM runtime as an ungoverned old mainline.
- Muscle memory catalog/platform registry as workflow truth.
- Compatibility, bridge or dual-truth tracks.
- Mediator routes that secretly plan/execute/decide business steps.
- Browser Session or target object that outlives its authority/execution epoch.
- Business-owned browser reconnect/election/transport.
- Audit warning-only, broad smoke-pass, manual matrix truth or runner-owned law binding.

Retired terms may appear only in deletion notes, migration reports, forbidden-regression fixtures or explicit mutant tests.
