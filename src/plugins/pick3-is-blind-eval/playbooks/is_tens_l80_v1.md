# IS Stream B L80 Playbook v1 — Phase 1

Position: `stream_b`

Stream B rule:

- Judge Stream B independently. Do not borrow Stream A or Stream C behavior.
- Require at least one confirming named shape before following a one-stroke impulse.
- Every prediction must be derived from named visual evidence. Analysis is mandatory before conclusion.
- Phase 1 live calibration: Stream B showed contrarian behavior. Treat `shoulder_hold` / `rise` / `upper_weighted` as lower evidence unless `high_pressure` or repeated `oscillation_hold_upper` also appears. Treat `kill_down` / `bare_low` as upper reversal risk unless `low_pressure` repeats across 3+ tail points.

Lower evidence patterns:

- Low or middle tail fails to hold above the shoulder after a rebound — name: `shoulder_reject` after `rise`.
- High tail returns toward the shoulder without renewed high support — name: `upper_fall` or `high_to_shoulder_edge`.
- Tail shows clear rejection of the red dashed horizontal line from below — name: `shoulder_reject`.
- Tail crosses into `shoulder_hold` after `rise` but lacks `high_pressure` or repeated `oscillation_hold_upper` — live-calibrated Stream B contrarian lower evidence.

Upper evidence patterns:

- Tail ends at lower zone with no rebound but lacks repeated `low_pressure` — name: `bare_low` + `kill_down`, live-calibrated Stream B upper reversal risk.
- Two or more recent points hold above the shoulder after crossing only when supported by `high_pressure` or repeated `oscillation_hold_upper` — name: `shoulder_hold`.
- Low extreme rebounds with continuation rather than a single isolated pop — name: `sharp_bottom` + `rise` continuing.
- High platform remains supported after a shallow dip — name: `high_pressure` with `slow_fall` not breaking.
- `oscillation_hold_upper` repeating after dips.

Evidence requirement:

- Name every shape word you observe in the tail.
- State whether L80 is upper-zone-weighted or lower-zone-weighted.
- State which named shape drove your direction conclusion.
- `discountedEvidence` contrarian rule: when you apply a Stream B contrarian override (e.g., treating `shoulder_hold` as lower evidence instead of upper, or treating `bare_low` / `kill_down` as upper reversal risk instead of lower), the standard visual-grammar interpretation you are overriding IS your discounted evidence. You must name it explicitly. `discountedEvidence` must NOT be null when a contrarian override is applied. Example: "Standard grammar classifies shoulder_hold as upper evidence; Stream B contrarian overrides this because high_pressure is absent."
- If `abstain`: name both the lower evidence and upper evidence that conflict and explain why neither outweighs the other.

Confidence rule:

- Use 0.51–0.75 for `lower` or `upper` per the calibration scale in visual-grammar.md.
- 0.51 means one named evidence item with no contradiction — this is a valid analysis conclusion, not a guess.
- Use null confidence only with `abstain`.
