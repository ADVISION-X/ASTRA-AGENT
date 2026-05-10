# Muscle Memory Four-Way Attack

This table is the governed allow-list review for every AI-visible muscle-memory actionCode under click-first visual-action governance.

| actionCode | AI required input | Decoder expansion | Geometry Guard | Target-not-visible rule | Final |
|---|---|---|---|---|---|
| CLICK_CELL | `gridCell` | `CLICK_CELL -> CLICK_BROWSER_COORDINATE` | PASS | Choose another visible action or `STOP_REVIEW_REQUIRED`; never guess raw x/y. | ALLOW |
| SAVE_LEAD | `(none)` | direct atomic | N/A | System-injected refs only; no click target needed. | ALLOW |
| OPEN_FACEBOOK_ENTRY | `(none)` | direct atomic | N/A | Governed open action only; no click target needed. | ALLOW |
| OPEN_TIKTOK_ENTRY | `(none)` | direct atomic | N/A | Governed open action only; no click target needed. | ALLOW |
| STOP_REVIEW_REQUIRED | `(none)` | direct atomic | N/A | Explicit fail-closed stop; never invent a target. | ALLOW |
| LIKE_CURRENT_VIDEO | `gridCell` | `LIKE_CURRENT_VIDEO -> CLICK_CELL -> CLICK_BROWSER_COORDINATE` | PASS | If the like button is not visibly grounded on the grid, stop or recover; do not fall back to hotkeys. | ALLOW |
| NEXT_VIDEO | `gridCell` | `NEXT_VIDEO -> CLICK_CELL -> CLICK_BROWSER_COORDINATE` | PASS | If no safe next target is visible, stop or recover; do not fall back to ArrowDown. | ALLOW |
| DISMISS_OVERLAY | `gridCell` | `DISMISS_OVERLAY -> CLICK_CELL -> CLICK_BROWSER_COORDINATE` | PASS | If no close or dismiss target is visible, use `STOP_REVIEW_REQUIRED`; do not send Escape blindly. | ALLOW |
| OPEN_COMMENTS | `gridCell` | `OPEN_COMMENTS -> CLICK_CELL -> CLICK_BROWSER_COORDINATE` | PASS | If no comments button is visible, use `STOP_REVIEW_REQUIRED`; do not invent a platform-specific selector. | ALLOW |
| SAVE_PRODUCT_AND_LIKE | `likeGridCell` | `SAVE_LEAD -> LIKE_CURRENT_VIDEO -> CLICK_CELL -> CLICK_BROWSER_COORDINATE` | PASS | Save uses injected refs; the like step must still be visibly grounded. | ALLOW |
| YES_SEEDING_VIDEO_FLOW | `likeGridCell`, `nextGridCell` | `SAVE_LEAD -> LIKE_CURRENT_VIDEO -> CLICK_CELL -> CLICK_BROWSER_COORDINATE -> NEXT_VIDEO -> CLICK_CELL -> CLICK_BROWSER_COORDINATE` | PASS | Missing either required click target is a governed reject/review, not a shortcut fallback. | ALLOW |
| NO_SEEDING_VIDEO_FLOW | `nextGridCell` | `NO_SEEDING_VIDEO_FLOW -> NEXT_VIDEO -> CLICK_CELL -> CLICK_BROWSER_COORDINATE` | PASS | Missing the next target requires stop or recovery, not a hidden navigation key. | ALLOW |

## Notes

- `CLICK_CELL` stays AI-visible because target choice is visual and must stay grid-based; execution still routes through Geometry Guard before Mouse Click.
- `PRESS_KEY`, `PRESS_NAVIGATION_KEY`, and `CLICK_BROWSER_COORDINATE` stay hidden and are not valid AI root actions.
- `LIKE_CURRENT_VIDEO`, `NEXT_VIDEO`, `DISMISS_OVERLAY`, and `OPEN_COMMENTS` are click-first composites; the AI chooses grid cells, not raw coordinates and not keyboard shortcuts.
- `SAVE_LEAD`, `OPEN_FACEBOOK_ENTRY`, `OPEN_TIKTOK_ENTRY`, and `STOP_REVIEW_REQUIRED` stay non-click semantics and do not require grid targets.