# IS Stream B L80 Playbook v1 — Phase 1

Position: `stream_b`

Stream B rule:

- Judge Stream B independently. Do not borrow Stream A or Stream C behavior.
- Require at least one confirming named shape before following a one-stroke impulse.
- Every prediction must be derived from named visual evidence drawn from the current image. Analysis is mandatory before conclusion.

Historical experience reference (not a hard rule): the patterns below are accumulated from past Stream B failure-case review, including a contrarian tendency discovered after Phase 1 live calibration. They describe a tendency, not a mandatory mapping. When the current image's actual evidence conflicts with a pattern below, the current image's evidence takes priority — you must still decide for yourself, weighing this experience only as one input alongside what you actually see.

Live-calibrated contrarian tendency: in past Stream B review, `shoulder_hold` / `rise` / `upper_weighted` alone turned out to lean lower more often than the standard grammar interpretation would suggest, unless `high_pressure` or repeated `oscillation_hold_upper` also appeared to confirm the upper read. Likewise `kill_down` / `bare_low` alone turned out to carry upper reversal risk more often than expected, unless `low_pressure` repeated across 3+ tail points to confirm the lower read. Treat both as historical tendencies to weigh, not switches to flip automatically — judge whether this image's own evidence actually supports the contrarian reading before applying it.

Historical tendency toward lower:

- Low or middle tail failing to hold above the shoulder after a rebound (`shoulder_reject` after `rise`) has historically leaned lower.
- High tail returning toward the shoulder without renewed high support (`upper_fall` or `high_to_shoulder_edge`) has historically leaned lower.
- Clear rejection of the red dashed horizontal line from below (`shoulder_reject`) has historically leaned lower.
- Tail crossing into `shoulder_hold` after `rise` but lacking `high_pressure` or repeated `oscillation_hold_upper` has historically leaned lower in Stream B's contrarian pattern — weigh this against how strong the hold looks in this image.

Historical tendency toward upper:

- Tail ending at lower zone with no rebound but lacking repeated `low_pressure` (`bare_low` + `kill_down`) has historically carried upper reversal risk in Stream B's contrarian pattern — weigh this against how convincing the low actually looks here.
- Two or more recent points holding above the shoulder after crossing, when supported by `high_pressure` or repeated `oscillation_hold_upper` (`shoulder_hold`), has historically leaned upper.
- A low extreme rebounding with continuation rather than a single isolated pop (`sharp_bottom` + `rise` continuing) has historically leaned upper.
- A high platform remaining supported after a shallow dip (`high_pressure` with `slow_fall` not breaking) has historically leaned upper.
- `oscillation_hold_upper` repeating after dips has historically leaned upper.

Evidence requirement:

- Name every shape word you observe in the tail.
- State whether L80 is upper-zone-weighted or lower-zone-weighted.
- State which named shape drove your direction conclusion.
- `discountedEvidence` contrarian rule: when you choose to follow a Stream B contrarian tendency (e.g., treating `shoulder_hold` as leaning lower instead of upper, or treating `bare_low` / `kill_down` as carrying upper reversal risk instead of leaning lower), the standard visual-grammar interpretation you are weighing against IS your discounted evidence. Name it explicitly and say why this image's evidence supported following the contrarian tendency rather than the standard reading. `discountedEvidence` must NOT be null in that case; it must NOT be null when a contrarian override is applied.
- If `abstain`: name both the lower evidence and upper evidence that conflict and explain why neither outweighs the other.

Confidence rule:

- Use 0.51–0.75 for `lower` or `upper` per the calibration scale in visual-grammar.md.
- 0.51 means one named evidence item with no contradiction — this is a valid analysis conclusion, not a guess.
- Use null confidence only with `abstain`.
