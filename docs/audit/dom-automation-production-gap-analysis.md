# DOM Automation Production Gap Analysis

status: active
createdAt: 2026-05-21
authority:
  - .github/instructions/agent-rules/modules/module-dom-automation.instructions.md
  - docs/法案辅助文件/GrassEye_DOM自动化生产稳定态施工图.md

## Executive Verdict

DOM Automation is active but not production-stable.

The original law file authorizes ten child abilities and contains DOM 014/015/016 for scroll, select, and overlay dismissal. Current production code exposes only seven child abilities, generated audit artifacts are stale, locator uncertainty still depends on thrown exceptions, and the audit/acceptance layer does not prove the production-stable surface.

## Gap Matrix

| Area | Required | Current | Gap | Remediation |
|---|---|---|---|---|
| Child ability list | Exactly ten: snapshot, locate, fill, click, upload, wait, verify, scroll, select, dismiss overlay | Seven in schema/facade | P0 | Add schema/facade/runtime for scroll, select, dismiss overlay |
| Generated law registry | DOM law IDs 001-016 from original law | generated registry lists 001-013 | P0 audit drift | Rebuild generated artifacts from source law/manifest |
| Snapshot | overlays, dropdownTriggers, loadingIndicators, stickyElements, expanded detected states | Missing new fields and states | P0 | Extend snapshot schema and collection script |
| Locator | structured locate result, new target kinds, no throw for normal uncertainty, proximity/component/CJK signals | Throws for not_found/ambiguous, limited target kinds | P0 | Add `DomLocateResult`, result API, proximity and component fields |
| Fill | Review empty/password/hidden/disabled, before/after evidence, verify value | Mostly present | P1 | Keep and verify via smoke |
| Click | DOM-first, dangerous text review, after evidence | Mostly present | P1 | Keep and verify via smoke |
| Upload | approved path equality, file-input only, evidence | Present | P1 | Keep and verify via smoke |
| Scroll | Located element only, bounded budget, viewport revalidation, evidence | Missing | P0 | Implement `scrollToElementOnce` |
| Select | Native select + custom dropdown, approved text, verification, evidence | Missing | P0 | Implement `selectOptionOnce` |
| Overlay dismissal | Safe allowlist, approved text, refuses auth/payment/delete, wait disappearance | Missing | P0 | Implement `dismissOverlayOnce` |
| Inspector | Runner-visible checks for ten abilities and DOM 014-016 | Only import-boundary/planner checks | P0 | Expand DOM inspector checks |
| Acceptance | Law/blueprint require DOM acceptance proof after owner inspector coverage | Only Amazon job acceptance exists | P0 | Add acceptance proof only as a subordinate audited artifact, not as a second CI truth chain |
| Owner boundaries | Plugins import public facade only; DOM runtime business-neutral | Mostly present | P1 | Inspector enforces |

## Implementation Checklist

- [x] Create this gap analysis document.
- [x] Extend schema and public facade to the ten legal child abilities.
- [x] Implement scroll/select/dismiss-overlay runtime files.
- [x] Convert locator normal uncertainty to structured result.
- [x] Extend snapshot output for overlays, dropdowns, loading, sticky elements.
- [ ] Add DOM-specific acceptance proof only after owner inspector enforcement is runner-visible.
- [x] Expand DOM inspector coverage.
- [x] Rebuild generated audit artifacts through the audit chain.
- [ ] Run `npm run ci:full` and fix first lawful blocker until green.

## Current Verification

- `npm run typecheck`: PASS.
- DOM owner report: PASS, zero findings, DOM law IDs 001-016 present.
- `npm run ci:full`: BLOCKED outside DOM by capability-group-governance and code-purity findings.

## LAW-GAP / External Blockers

1. `src/capabilities/video-download/**` exists, but capability-group-governance currently approves only `dom-automation`, `ai-input-gateway`, and `forensics-persistence` as active ability groups. Adding video-download to that allowlist would be a law change, not an implementation fix.
2. Resolved by the code-purity red-line update: DOM law requires the public facade to expose all ten child ability functions and public contracts, and code-purity now enforces a binary named-export red line of 24 instead of the old limit of 10.
3. Existing global code-purity findings remain outside DOM, including audit helper budgets, Amazon acceptance/file budgets, and existing broad facade export surfaces.

## Non-Editable Law Note

This task does not edit active law files. The original DOM law is treated as authority. Generated artifact drift is repaired through the audit build chain, not by hand-editing generated files.
