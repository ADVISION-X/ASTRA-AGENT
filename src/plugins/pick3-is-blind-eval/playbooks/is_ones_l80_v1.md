# IS Stream C L80 Playbook v1 — Phase 1

Position: `stream_c`

Stream C rule:

- Judge Stream C independently. Do not borrow Stream A or Stream B behavior.
- For one-stroke impulse tails: require at least one named confirming cue before concluding. One confirming cue is sufficient — do not require two.
- Every prediction must be derived from named visual evidence drawn from the current image. Analysis is mandatory before conclusion.

Historical experience reference (not a hard rule): the patterns below are accumulated from past Stream C failure-case review. They describe a tendency, not a mandatory mapping. When the current image's actual evidence conflicts with a pattern below, the current image's evidence takes priority — you must still decide for yourself, weighing this experience only as one input alongside what you actually see.

Historical tendency toward lower:

- Tail approaching the shoulder from below and visibly rejecting (`shoulder_reject`) has historically leaned lower.
- An isolated high spike followed by shoulder-return pressure (`sharp_top` + `shoulder_return`) has historically leaned lower.
- Recent high area losing support across multiple points (`high_pressure` dissolving into `upper_fall`) has historically leaned lower.
- Tail ending at lower zone with lower-zone weight in L80 (`bare_low` or `kill_down` + `low_pressure`) has historically leaned lower.

Historical tendency toward upper:

- A low crash rebounding and then holding above the shoulder (`sharp_bottom` + `shoulder_hold`) has historically leaned upper.
- A high platform persisting instead of forming a single isolated spike (`high_pressure` sustained) has historically leaned upper.
- Tail leaving low pressure with confirmed upward structure (`sharp_bottom` + `rise` with continuation) has historically leaned upper.

Evidence requirement:

- Name every shape word you observe in the tail.
- State whether L80 is upper-zone-weighted or lower-zone-weighted.
- State which named shape drove your direction conclusion.
- If you weigh a historical tendency above against this image's own evidence and they disagree, say so in `reason` and explain which one you followed and why.
- If `abstain`: name both the lower evidence and upper evidence that conflict and explain why neither outweighs the other. Both must be strong named signals of equal weight — not just uncertainty.

Confidence rule:

- Use 0.51–0.75 for `lower` or `upper` per the calibration scale in visual-grammar.md.
- 0.51 means one named evidence item with no contradiction — this is a valid analysis conclusion, not a guess.
- Use null confidence only with `abstain`.
