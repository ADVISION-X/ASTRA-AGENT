# IS L80 Visual Grammar — Phase 1

Use this grammar to name every visual feature you observe in the tail and across the L80 window. You must name what you see before you can conclude a direction. Unnamed intuition is not valid evidence.

Vocabulary restriction: `tailShapes` must contain only words defined in this file. Words like "rise" are defined here and are valid. Words like "climb", "ascending", "drop", "descend", "upward", "downward", or any word not listed below are informal and invalid in `tailShapes`. Using an undefined word is a parse failure.

Motion words:

- `surge_up`: large upward tail stroke, clearly crossing the shoulder upward.
- `rise`: clear upward move, approaching or touching the shoulder from below.
- `slow_rise`: small upward move, tail still clearly below shoulder.
- `hold`: flat or nearly flat tail, no directional commitment.
- `slow_fall`: small downward move, tail still near shoulder.
- `upper_fall`: clear downward move from an upper-zone area, still in progress.
- `kill_down`: large downward drop, ending at or near recent lows.

Shape words:

- `sharp_top`: upward motion followed by visible downward pressure. Spike-like. One isolated high.
- `sharp_bottom`: downward motion followed by upward pressure ALREADY VISIBLE in the tail. V-shape forming. The rebound must have started — a bare low point with no rebound is not a sharp_bottom.
- `bare_low`: tail ends at a recent extreme low with NO rebound visible. The weight is still in the lower zone. This is a lower-leaning signal.
- `upward_inertia`: repeated upward tail movement across 3+ recent points.
- `downward_inertia`: repeated downward tail movement across 3+ recent points.
- `shoulder_return`: tail returns toward the red dashed horizontal line from either side.
- `shoulder_reject`: tail approaches the red dashed horizontal line but fails to cross or hold. Clear bounce away.
- `shoulder_hold`: tail crosses the red dashed horizontal line and stays above it for 2+ recent points.
- `high_pressure`: repeated upper-band contact above the shoulder across multiple recent points.
- `low_pressure`: repeated lower-band contact below the shoulder across multiple recent points. Tail weight is in the lower zone.
- `high_to_shoulder_edge`: tail descends from the upper band and the most recent point sits near the shoulder edge, still falling.
- `oscillation_hold_upper`: alternating moves but consistently returning to upper zone after each lower dip.
- `disordered_chop`: alternating moves with no stable continuation.

Analysis discipline:

- Step 1 — Name the tail: read the last 3–8 points and name every motion word and shape word that applies. Do not skip this step.
- Step 2 — Name the L80 zone weight: does the full L80 window spend more points above or below the red dashed horizontal line? State this explicitly.
- Step 3 — Derive direction: let the named tail shape and zone weight together determine your conclusion. Do not reach a conclusion before completing steps 1 and 2.
- Step 4 — Assign confidence: reflect how many named evidence items support the conclusion and whether they agree.

Evidence rules:

- `bare_low` is a lower-leaning signal. `bare_low` means the tail weight is in the lower zone with no rebound. Conclude `lower` unless named upper evidence of equal or greater weight is also present.
- `kill_down` into `bare_low` with `low_pressure` in L80 is multi-signal lower evidence. Conclude `lower`.
- `sharp_top` with prior `high_pressure` that then falls toward shoulder is lower evidence. Conclude `lower`.
- `shoulder_hold` sustained 2+ points is upper evidence. Conclude `upper`.
- `oscillation_hold_upper` is upper evidence. Conclude `upper`.
- When tail shape and L80 zone weight point in the same direction: this is multi-signal evidence. Conclude accordingly with higher confidence.
- When tail shape and L80 zone weight point in opposite directions and neither clearly dominates: name both and choose `abstain`.
- A single named shape word with no contradicting evidence is sufficient to conclude. Low evidence quantity → low confidence (0.51), not abstain.
- Do not choose `abstain` because the signal is weak.

Confidence calibration:

- `0.51`: one named shape word identified, no contradiction present, direction follows from that shape.
- `0.55`: one clear named shape with 2+ confirming tail points.
- `0.60`: named shape + L80 zone weight agree, no contradicting named evidence.
- `0.65–0.75`: multiple named shapes all pointing the same direction + L80 zone weight agrees.
- Use `null` confidence only with `abstain`.
