# GrassEye Lottery Ticket Plan 施工图

version: 2026-06-21
status: construction-blueprint
targetLaw: `.github/instructions/agent-rules/modules/module-lottery-ticket-plan.instructions.md`
capabilityDomain: `lottery-ticket-plan`
targetPlugin: `src/plugins/lottery-ticket-plan`

施工图只作为实现地图，不高于 active law。

## Local Plan Boundary

`lottery-ticket-plan` creates local ticket plans for human review.

It must never automate a wagering website:

```txt
no official My Plan write
no cart / checkout / payment action
no login / cookie / localStorage / browser profile handling
no age gate or location gate handling
```

The first local plan is Pick3:

```txt
hundreds bucket -> upper | lower
tens bucket -> upper | lower
ones bucket -> upper | lower
upper -> 5,6,7,8,9
lower -> 0,1,2,3,4
5 * 5 * 5 -> 125 ticket lines
```

## Plugin File Plan

```txt
src/plugins/lottery-ticket-plan/
  index.ts
  lottery-ticket-plan.schema.ts
  lottery-ticket-plan.flow.ts
```

The public facade is `index.ts`.

No file in this plugin may import:

```txt
src/plugins/pick3-is-blind-eval/**
src/capabilities/dom-automation/**
src/lib/browser/**
src/capabilities/ai-input-gateway/**
```

## App Shell Surface

```txt
src/app/app-shell/lottery-ticket-plan-workspace.ts
src/app/workbench-home-lottery-ticket-plan-client.ts
src/app/workbench-lottery-ticket-plan-routes.ts
src/lib/local-runtime/workbench-lottery-ticket-plan-support.ts
```

The page collects only structured local inputs:

```txt
game: pick3
hundreds: upper | lower
tens: upper | lower
ones: upper | lower
entryCost: positive number
```

The page displays:

```txt
ticketCount
estimatedTotalCost
ticketHash
manualPurchaseOnly
125 generated ticket lines
```

## QA Plan

Acceptance must prove:

```txt
upper/lower Pick3 generates 125 lines
first and last line are deterministic
ticketHash is stable
manualPurchaseOnly is true
invalid bucket fails
```

Audit must prove:

```txt
law / blueprint / manifest / inspector exist
plugin files exist
App Shell route and client markers exist
package scripts exist
no Pick3 blind-eval import
no browser / DOM / AI gateway import
no official purchase terms in runtime code
```
