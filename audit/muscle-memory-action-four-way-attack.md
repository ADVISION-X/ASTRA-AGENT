# Muscle Memory Four-Way Attack

This table is the governed allow-list review for every AI-visible muscle-memory actionCode.

| actionCode | AI boundary | Decoder/Scheduler | Capability Strength | Platform/Safety/Forensics | Final |
|---|---|---|---|---|---|
| CLICK_CELL | PASS | PASS | PASS | PASS | ALLOW |
| SAVE_LEAD | PASS | PASS | PASS | PASS | ALLOW |
| OPEN_FACEBOOK_ENTRY | PASS | PASS | PASS | PASS | ALLOW |
| OPEN_TIKTOK_ENTRY | PASS | PASS | PASS | PASS | ALLOW |
| STOP_REVIEW_REQUIRED | PASS | PASS | PASS | PASS | ALLOW |
| LIKE_CURRENT_VIDEO | PASS | PASS | PASS | PASS | ALLOW |
| NEXT_VIDEO | PASS | PASS | PASS | PASS | ALLOW |
| DISMISS_OVERLAY | PASS | PASS | PASS | PASS | ALLOW |
| SAVE_PRODUCT_AND_LIKE | PASS | PASS | PASS | PASS | ALLOW |
| YES_SEEDING_VIDEO_FLOW | PASS | PASS | PASS | PASS | ALLOW |
| NO_SEEDING_VIDEO_FLOW | PASS | PASS | PASS | PASS | ALLOW |

## Notes

- `CLICK_CELL` stays AI-visible because target choice is visual and must stay grid-based; execution still routes through Geometry Guard before Mouse Click.
- `PRESS_KEY` and `PRESS_NAVIGATION_KEY` stay hidden and are only reachable through governed composite expansion.
- `OPEN_FACEBOOK_ENTRY` and `OPEN_TIKTOK_ENTRY` are the only recovery/open semantics kept visible in this round; no `RECOVER_*` duplicates are added.
- `LIKE_AND_NEXT_VIDEO`, `WAIT_SHORT`, `CLICK_VISIBLE_TARGET`, `OPEN_COMMENTS`, and `CAPTURE_COMMENTS` remain out of scope for this round.