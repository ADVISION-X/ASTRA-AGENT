---
description: "GrassEye Lottery Ticket Plan generator law: local-only upper/lower ticket plan generation without betting-site DOM automation or purchase submission."
applyTo: "src/plugins/lottery-ticket-plan/**/*.ts,src/app/workbench-lottery-ticket-plan-*.ts,scripts/audit/domains/lottery-ticket-plan/**/*.ts,scripts/acceptance/lottery-ticket-plan.acceptance.ts,docs/法案辅助文件/GrassEye Lottery Ticket Plan 施工图.md"
---

# GrassEye Lottery Ticket Plan Law

status: active
version: 2026-06-21
capabilityDomain: lottery-ticket-plan

Scope: `lottery-ticket-plan` is the only GrassEye owner for local lottery ticket plan generation from user-selected digit buckets.

This domain is not a betting executor. It creates a local, human-reviewable ticket plan only.

## Required

- The job id is `lottery-ticket-plan`.
- The plugin root is `src/plugins/lottery-ticket-plan/`.
- The first supported game is `pick3`.
- Pick3 positions are `hundreds`, `tens`, and `ones`.
- A user choice of `upper` expands to digits `5,6,7,8,9`.
- A user choice of `lower` expands to digits `0,1,2,3,4`.
- Pick3 must generate exactly `5 * 5 * 5 = 125` ticket lines for three selected buckets.
- Ticket lines must be generated deterministically in position order.
- The result must include `ticketCount`, `ticketHash`, `estimatedEntryCost`, `estimatedTotalCost`, and `manualPurchaseOnly: true`.
- The App Shell may expose a local plan page that displays generated ticket lines and summary.
- The App Shell page must make clear that generated plans are for manual review only.
- This owner must stay independent from `pick3-is-blind-eval`; it must not import Pick3 blind-eval runtime files.
- Future Pick4 support must extend this owner through the same local plan contract, not by coupling to the blind-eval executor.

## Forbidden

- No betting-site DOM automation.
- No clicking, filling, adding, or submitting tickets on `theuaelottery.ae` or any other wagering site.
- No writing to official site `My Plan`, cart, basket, checkout, or payment state.
- No login, cookies, local storage, browser profile, account, age gate, location gate, or payment handling.
- No wager recommendation, stake sizing, expected value claim, or中奖概率 claim.
- No importing `src/plugins/pick3-is-blind-eval/**`.
- No browser controller, DOM automation, AI Input Gateway, or external provider call in this owner.

## Law IDs

```apex-law
{
  "lawId": "GRASSEYE-LOTTERY-TICKET-PLAN-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "lottery-ticket-plan",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+acceptance+audit",
  "summary": "Lottery Ticket Plan must generate local upper/lower ticket plans for human review only, starting with Pick3 125-line plans, without betting-site DOM automation or purchase submission.",
  "required": [
    "Pick3 upper/lower bucket expansion generates exactly 125 local ticket lines.",
    "Results include manualPurchaseOnly: true and deterministic ticketHash.",
    "The domain stays independent from pick3-is-blind-eval."
  ],
  "forbidden": [
    "betting-site DOM automation",
    "official My Plan, cart, checkout, or payment writes",
    "login, cookies, localStorage, account, age gate, location gate, or payment handling",
    "wager recommendation, stake sizing, or probability claim"
  ]
}
```
