# IS Stream A L80 Playbook v1 — Phase 1

Position: `stream_a`

Stream A rule:

- Judge Stream A independently. Do not borrow Stream B or Stream C behavior.
- Prefer clear tail structure over broad historical feel.
- Every prediction must be derived from named visual evidence drawn from the current image. Analysis is mandatory before conclusion.

Historical experience reference (not a hard rule): the patterns below are accumulated from past Stream A failure-case review. They describe a tendency, not a mandatory mapping. When the current image's actual evidence conflicts with a pattern below, the current image's evidence takes priority — you must still decide for yourself, weighing this experience only as one input alongside what you actually see.

Historical tendency toward lower:

- High tail extends far above the shoulder and then bends down toward the shoulder — named `sharp_top` or `upper_fall` — has historically leaned lower, but confirm against this image's own tail behavior before concluding.
- Tail rises toward the red dashed horizontal line from below but does not clearly hold above it — named `shoulder_reject` — has historically leaned lower when the rejection is clean; weigh against how convincing the rejection looks here.
- Repeated high-area exhaustion (`sharp_top` + `high_pressure` losing) has historically leaned lower, but a single instance is weaker evidence than a repeated one.
- Tail ending at a low with no rebound and lower-zone weight across L80 (`bare_low` + `low_pressure`) has historically leaned lower.

Historical tendency toward upper:

- Tail crossing the shoulder and holding above it for multiple recent points (`shoulder_hold`) has historically leaned upper, but check whether the hold in this image is genuinely multi-point or just a brief touch.
- A clear rebound from a low extreme that continues through the shoulder (`sharp_bottom` + `rise`) has historically leaned upper.
- A sustained high platform rather than a single isolated spike (`high_pressure` sustained) has historically leaned upper.
- `oscillation_hold_upper` with consistent return to the upper zone has historically leaned upper.

Evidence requirement:

- Name every shape word you observe in the tail.
- State whether L80 is upper-zone-weighted or lower-zone-weighted.
- State which named shape drove your direction conclusion.
- If you weigh a historical tendency above against this image's own evidence and they disagree, say so in `reason` and explain which one you followed and why.
- If `abstain`: name both the lower evidence and upper evidence that conflict and explain why neither outweighs the other.

Confidence rule:

- Use 0.51–0.75 for `lower` or `upper` per the calibration scale in visual-grammar.md.
- 0.51 means one named evidence item with no contradiction — this is a valid conclusion, not a guess.
- Use null confidence only with `abstain`.
