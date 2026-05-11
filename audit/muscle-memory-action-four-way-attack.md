# Muscle Memory Four-Way Attack

This file is a historical-transition audit note.
It does not define final law or blueprint authority.
Final authority now says MuscleMemoryCatalog is a capability registry of atomic child capabilities.
Semantic actions and business-flow packages listed here are code-gap residue only.

## Transitional Semantic Entries

| historical token | current residue shape | atomic replacement direction | final status |
|---|---|---|---|
| LIKE_CURRENT_VIDEO | semantic click intent | LEFT_CLICK_GRID_CELL_ONCE(likeButtonGridCell) | HISTORICAL ONLY |
| NEXT_VIDEO | semantic navigation intent | LEFT_CLICK_GRID_CELL_ONCE(nextButtonGridCell) or governed scroll primitive | HISTORICAL ONLY |
| DISMISS_OVERLAY | semantic overlay intent | LEFT_CLICK_GRID_CELL_ONCE(closeButtonGridCell) or STOP_REVIEW_REQUIRED_ONCE | HISTORICAL ONLY |
| OPEN_COMMENTS | semantic panel intent | LEFT_CLICK_GRID_CELL_ONCE(commentButtonGridCell) | HISTORICAL ONLY |
| SAVE_PRODUCT_AND_LIKE | business package | SAVE_EVIDENCE_RECORD_ONCE + LEFT_CLICK_GRID_CELL_ONCE(likeButtonGridCell) | HISTORICAL ONLY |
| YES_SEEDING_VIDEO_FLOW | business flow | AI-composed atomic capability sequence | HISTORICAL ONLY |
| NO_SEEDING_VIDEO_FLOW | business flow | AI-composed atomic capability sequence | HISTORICAL ONLY |

## Final Atomic Direction

Allowed final-direction examples:
- LEFT_CLICK_GRID_CELL_ONCE
- RIGHT_CLICK_GRID_CELL_ONCE
- PRESS_KEY_ONCE
- TYPE_TEXT_ONCE
- CAPTURE_VIEWPORT_ONCE
- CAPTURE_REGION_ONCE
- OPEN_PLATFORM_ENTRY_ONCE
- SAVE_EVIDENCE_RECORD_ONCE
- STOP_REVIEW_REQUIRED_ONCE

## Governance Notes

- Semantic tokens in this file are anti-examples or retirement targets only.
- They must not be treated as final child capabilities.
- They must not be treated as final MuscleMemoryCatalog truth.
- AI should compose atomic registry entries instead of selecting these semantic residues.